function clean(v){return String(v??"").replace(/\\s+/g," ").trim();}
function norm(v){return clean(v).normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase();}
function parsePrice(v){const m=clean(v).replace(/\\u00a0/g," ").match(/(\\d{1,4}(?:[.,]\\d{1,2})?)\\s*€/);if(!m)return null;const n=Number(m[1].replace(",","."));return Number.isFinite(n)?n:null;}
function pack(v){const m=clean(v).match(/\\b\\d+(?:[.,]\\d+)?\\s*(kg|g|l|cl|ml)\\b/i);return m?m[0].replace(",","."):null;}
function filter(items,q){const w=norm(q);return w?items.filter(x=>norm([x.name,x.brand,x.packSize].join(" ")).includes(w)):items;}
async function get(url){
 const r=await fetch(url,{redirect:"follow",headers:{"User-Agent":"BudgetCourses/7.0","Accept":"text/html,application/xhtml+xml,application/json"}});
 if(!r.ok) throw new Error(`HTTP ${r.status}`);
 return await r.text();
}
function jsonLd(html,url){
 const out=[];
 const re=new RegExp("<script[^>]*type=[\"']application\\\\/ld\\\\+json[\"'][^>]*>([\\\\s\\\\S]*?)<\\\\/script>","gi");
 let m;
 while((m=re.exec(html))){
  try{
   const raw=JSON.parse(m[1].trim());
   const arr=Array.isArray(raw)?raw:(Array.isArray(raw?.["@graph"])?raw["@graph"]:[raw]);
   for(const x of arr){
    if(!x||x["@type"]!=="Product") continue;
    const o=Array.isArray(x.offers)?x.offers[0]:x.offers;
    const p=Number(String(o?.price??"").replace(",","."));
    out.push({
      id:clean(x.gtin||x.sku||x.url||x.name),
      ean:clean(x.gtin)||null,
      name:clean(x.name),
      brand:clean(x.brand?.name||x.brand)||null,
      packSize:pack(x.name),
      price:Number.isFinite(p)?p:null,
      unitPrice:null,
      currency:clean(o?.priceCurrency)||"EUR",
      verified:Number.isFinite(p),
      sourceUrl:clean(x.url)||url,
      updatedAt:new Date().toISOString(),
      availability:clean(o?.availability)||null
    });
   }
  }catch{}
 }
 return out;
}
module.exports={clean,norm,parsePrice,pack,filter,get,jsonLd};
