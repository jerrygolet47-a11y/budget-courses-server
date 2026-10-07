const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const STORES = [
  {
    id: "auchan",
    name: "Auchan",
    officialUrl: "https://www.auchan.fr/courses",
    search: (q) =>
      "https://www.auchan.fr/recherche?text=" + encodeURIComponent(q)
  },
  {
    id: "intermarche",
    name: "Intermarché",
    officialUrl: "https://www.intermarche.com/",
    search: (q) =>
      "https://www.intermarche.com/recherche?text=" + encodeURIComponent(q)
  },
  {
    id: "superu",
    name: "Super U",
    officialUrl: "https://www.coursesu.com/drive-france",
    search: (q) =>
      "https://www.coursesu.com/recherche?q=" +
      encodeURIComponent(q) +
      "&lang=fr_FR"
  },
  {
    id: "aldi",
    name: "ALDI",
    officialUrl: "https://www.aldi.fr/liste-de-courses.html",
    search: (q) =>
      "https://www.aldi.fr/liste-de-courses.html?search=" +
      encodeURIComponent(q)
  },
  {
    id: "lidl",
    name: "Lidl",
    officialUrl: "https://www.lidl.fr/online",
    search: (q) =>
      "https://www.lidl.fr/q/query/" + encodeURIComponent(q)
  },
  {
    id: "carrefour",
    name: "Carrefour",
    officialUrl: "https://www.carrefour.fr/services/drive",
    search: (q) =>
      "https://www.carrefour.fr/s?q=" + encodeURIComponent(q)
  },
  {
    id: "leclerc",
    name: "E.Leclerc",
    officialUrl: "https://www.leclercdrive.fr/",
    search: (q) =>
      "https://www.leclercdrive.fr/recherche.aspx?search=" +
      encodeURIComponent(q)
  }
];

const CATEGORIES = [
  "Fruits & légumes",
  "Viandes & poissons",
  "Crèmerie",
  "Charcuterie & traiteur",
  "Surgelés",
  "Bébé",
  "Épicerie salée",
  "Épicerie sucrée",
  "Boissons",
  "Pains & pâtisseries",
  "Bio & écologie",
  "Entretien",
  "Maison",
  "Animalerie"
];

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

function getStore(id) {
  return STORES.find((store) => store.id === id);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parsePrice(value) {
  const text = clean(value)
    .replace(/\u00a0/g, " ")
    .replace(",", ".");

  const match = text.match(
    /(?:^|\s)(\d{1,3}(?:[ .]\d{3})*(?:\.\d{1,2})?)\s*€/
  );

  if (!match) return null;

  const number = Number(match[1].replace(/\s/g, ""));

  return Number.isFinite(number) ? number : null;
}

function parseUnitPrice(value) {
  const text = clean(value)
    .replace(/\u00a0/g, " ")
    .replace(",", ".");

  const match = text.match(
    /(\d+(?:\.\d{1,2})?)\s*€?\s*\/\s*(KG|L)\b/i
  );

  if (!match) return null;

  const number = Number(match[1]);

  return Number.isFinite(number) ? number : null;
}

function parsePackSize(value) {
  const text = clean(value);

  const match = text.match(
    /\b\d+(?:[.,]\d+)?\s?(?:KG|G|MG|L|CL|ML)\b/i
  );

  return match ? match[0] : null;
}

function addProduct(output, product, sourceUrl) {
  if (!product || !product.name) return;

  if (product.price == null || !Number.isFinite(product.price)) {
    return;
  }

  const name = clean(product.name);

  if (name.length < 2) return;

  const key =
    normalize(name) +
    "|" +
    product.price +
    "|" +
    (product.packSize || "");

  if (output.some((item) => item.key === key)) return;

  output.push({
    id: Buffer.from(sourceUrl + "|" + name)
      .toString("base64url")
      .slice(0, 48),
    name,
    brand: product.brand || null,
    category: product.category || "Non classé",
    packSize: product.packSize || null,
    price: product.price,
    unitPrice: product.unitPrice ?? null,
    currency: "EUR",
    promotion: product.promotion || null,
    available: product.available ?? null,
    sourceUrl,
    updatedAt: new Date().toISOString(),
    key
  });
}

function parseJsonLd($, output, sourceUrl) {
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const raw = $(element).text();

      if (!raw) return;

      const data = JSON.parse(raw);
      const objects = Array.isArray(data) ? data : [data];

      for (const object of objects) {
        if (!object) continue;

        const products = [];

        if (
          object["@type"] === "Product" ||
          object.name
        ) {
          products.push(object);
        }

        if (Array.isArray(object.itemListElement)) {
          for (const item of object.itemListElement) {
            if (item && item.item) {
              products.push(item.item);
            } else if (item) {
              products.push(item);
            }
          }
        }

        for (const product of products) {
          const offers = Array.isArray(product.offers)
            ? product.offers[0]
            : product.offers;

          const rawPrice =
            offers?.price ??
            product.price ??
            null;

          const price = Number(rawPrice);

          if (product.name && Number.isFinite(price)) {
            addProduct(
              output,
              {
                name: product.name,
                price,
                brand:
                  typeof product.brand === "string"
                    ? product.brand
                    : product.brand?.name || null
              },
              sourceUrl
            );
          }
        }
      }
    } catch (_) {
      // Donnée JSON-LD non exploitable.
    }
  });
}

function parseProductCards($, output, sourceUrl) {
  const selectors = [
    "article",
    "li",
    "[class*='product']",
    "[class*='Product']",
    "[data-testid*='product']",
    "[data-product]"
  ];

  $(selectors.join(",")).each((_, element) => {
    const card = $(element);
    const text = clean(card.text());

    if (!text) return;

    const price = parsePrice(text);

    if (price == null) return;

    const name = clean(
      card
        .find(
          "h1,h2,h3,h4,h5,[class*='name'],[class*='Name'],[class*='title'],[class*='Title']"
        )
        .first()
        .text()
    );

    if (!name) return;

    addProduct(
      output,
      {
        name,
        price,
        unitPrice: parseUnitPrice(text),
        packSize: parsePackSize(text)
      },
      sourceUrl
    );
  });
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "BudgetCoursesOfficialSource/3.0",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.7"
    }
  });

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  return response.text();
}

/* Sources officielles ALDI */
const ALDI_CATEGORY_PAGES = [
  "https://www.aldi.fr/produits/produits-laitiers/creme-beurre.html",
  "https://www.aldi.fr/produits/produits-laitiers/fromage-a-tartiner.html",
  "https://www.aldi.fr/produits/produits-laitiers/fromage-rape-tranche.html",
  "https://www.aldi.fr/produits/epicerie-salee.html",
  "https://www.aldi.fr/produits/epicerie-sucree.html",
  "https://www.aldi.fr/produits/boissons.html"
];

/* Fiches produits officielles ALDI */
const ALDI_OFFICIAL_PRODUCTS = [
  {
    keywords: ["lait", "demi ecreme"],
    url:
      "https://www.aldi.fr/fiches-produits/lait-demi-ecreme-1870.html"
  },
  {
    keywords: ["lait", "entier"],
    url:
      "https://www.aldi.fr/fiches-produits/lait-entier-brique-0601.html"
  },
  {
    keywords: ["lait", "uht"],
    url:
      "https://www.aldi.fr/fiches-produits/lait-uht-demi-ecreme-0600.html"
  }
];

async function fetchAldiProductPage(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const output = [];

  parseJsonLd($, output, url);

  const bodyText = clean($("body").text());
  const title = clean($("h1").first().text());
  const price = parsePrice(bodyText);

  if (title && price != null) {
    addProduct(
      output,
      {
        name: title,
        price,
        unitPrice: parseUnitPrice(bodyText),
        packSize: parsePackSize(bodyText)
      },
      url
    );
  }

  return output;
}

async function fetchAldi(query) {
  const normalizedQuery = normalize(query);
  const output = [];

  /* Pages officielles de catégories */
  for (const url of ALDI_CATEGORY_PAGES) {
    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      parseJsonLd($, output, url);
      parseProductCards($, output, url);
    } catch (error) {
      console.log(
        "ALDI category unavailable:",
        url,
        error.message
      );
    }
  }

  /* Fiches officielles ciblées */
  const matchingPages = ALDI_OFFICIAL_PRODUCTS.filter((item) => {
    return item.keywords.some((keyword) =>
      normalizedQuery.includes(normalize(keyword))
    );
  });

  for (const item of matchingPages) {
    try {
      const products = await fetchAldiProductPage(item.url);

      for (const product of products) {
        addProduct(output, product, product.sourceUrl);
      }
    } catch (error) {
      console.log(
        "ALDI product unavailable:",
        item.url,
        error.message
      );
    }
  }

  /* Filtrage */
  const words = normalizedQuery
    .split(/\s+/)
    .filter(Boolean);

  const filtered = output.filter((product) => {
    const name = normalize(product.name);

    return words.every((word) => name.includes(word));
  });

  const products = filtered
    .slice(0, 100)
    .map(({ key, ...product }) => product);

  return {
    verified: products.length > 0,

    sourceUrl:
      products[0]?.sourceUrl ||
      "https://www.aldi.fr/liste-de-courses.html",

    updatedAt: new Date().toISOString(),

    products,

    message:
      products.length > 0
        ? "Prix extraits des pages officielles ALDI France."
        : "Aucun produit correspondant trouvé sur les sources officielles ALDI."
  };
}

async function fetchOfficial(storeInfo, query) {
  /* Connecteur ALDI */
  if (storeInfo.id === "aldi") {
    const cacheKey = "aldi|" + normalize(query);
    const cached = cache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.time < CACHE_MS
    ) {
      return cached.data;
    }

    const data = await fetchAldi(query);

    cache.set(cacheKey, {
      time: Date.now(),
      data
    });

    return data;
  }

  /* Connecteur générique prudent pour les autres enseignes */
  const url = storeInfo.search(query);
  const cached = cache.get(url);

  if (
    cached &&
    Date.now() - cached.time < CACHE_MS
  ) {
    return cached.data;
  }

  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const output = [];

  parseJsonLd($, output, url);
  parseProductCards($, output, url);

  const data = {
    verified: output.length > 0,
    sourceUrl: url,
    updatedAt: new Date().toISOString(),

    products: output
      .slice(0, 100)
      .map(({ key, ...product }) => product),

    message:
      output.length > 0
        ? "Données extraites depuis une page officielle."
        : "La page officielle ne fournit pas de prix exploitables sans contexte magasin/session."
  };

  cache.set(url, {
    time: Date.now(),
    data
  });

  return data;
}

/* Santé du serveur */
app.get("/api/health", (_, response) => {
  response.json({
    ok: true,
    service: "budget-courses-server",
    version: "3.0.0",
    sources: "official-only",
    time: new Date().toISOString()
  });
});

/* Liste des magasins */
app.get("/api/stores", (_, response) => {
  response.json(
    STORES.map(({ id, name, officialUrl }) => ({
      id,
      name,
      officialUrl
    }))
  );
});

/* Recherche de magasin */
app.get(
  "/api/stores/:store/locations",
  (request, response) => {
    const storeInfo = getStore(request.params.store);

    if (!storeInfo) {
      return response.status(404).json({
        error: "store_not_found"
      });
    }

    response.json([
      {
        id: storeInfo.id + "-official",
        storeId: storeInfo.id,
        name: storeInfo.name + " — recherche officielle",

        postalCode:
          clean(request.query.postalCode),

        city:
          clean(request.query.city),

        verified: false,

        sourceUrl:
          storeInfo.officialUrl,

        message:
          "Le prix local dépend du magasin/Drive sélectionné sur le site officiel."
      }
    ]);
  }
);

/* Catégories */
app.get(
  "/api/stores/:store/locations/:locationId/categories",
  (request, response) => {
    const storeInfo = getStore(request.params.store);

    if (!storeInfo) {
      return response.status(404).json({
        error: "store_not_found"
      });
    }

    response.json(CATEGORIES);
  }
);

/* Produits */
app.get(
  "/api/stores/:store/locations/:locationId/products",
  async (request, response) => {
    const storeInfo = getStore(request.params.store);

    if (!storeInfo) {
      return response.status(404).json({
        error: "store_not_found"
      });
    }

    const query =
      clean(request.query.q) || "lait";

    try {
      const data =
        await fetchOfficial(
          storeInfo,
          query
        );

      response.json({
        store: storeInfo.id,
        locationId:
          request.params.locationId,
        query,
        ...data
      });
    } catch (error) {
      console.error(
        "Official source error:",
        error
      );

      response.status(502).json({
        error:
          "official_source_unavailable",

        store:
          storeInfo.id,

        message:
          "La source officielle est indisponible ou nécessite une session/magasin.",

        sourceUrl:
          storeInfo.search(query)
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(
    "Budget Courses server listening on port " +
      PORT
  );
});
