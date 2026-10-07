const express=require("express"),cors=require("cors");
const adapters={aldi:require("./adapters/aldi"),lidl:require("./adapters/lidl"),carrefour:require("./adapters/carrefour"),leclerc:require("./adapters/leclerc"),intermarche:require("./adapters/intermarche"),superu:require("./adapters/superu"),auchan:require("./adapters/auchan")};
const app=express(),PORT=Number(process.env.PORT)||3000; app.use(cors()); app.use(express.json());
function a(s){return adapters[String(s||"").toLowerCase()]||null;}
app.get("/api/health",(q,r)=>r.json({ok:true,service:"budget-courses-server",version:"7.0.0",architecture:"selection-first",sources:"official-only",time:new Date().toISOString()}));
app.get("/api/stores",(q,r)=>r.json({stores:Object.entries(adapters).map(([id,x])=>({id,name:x.name,supported:true}))}));
app.get("/api/stores/:store/locations",async(q,r)=>{const x=a(q.params.store);if(!x)return r.status(404).json({ok:false,error:"Enseigne inconnue"});try{r.json(await x.getLocations({postalCode:q.query.postalCode||"",city:q.query.city||""}))}catch(e){r.status(502).json({ok:false,error:e.message})}});
app.get("/api/stores/:store/locations/:locationId/categories",async(q,r)=>{const x=a(q.params.store);if(!x)return r.status(404).json({ok:false,error:"Enseigne inconnue"});try{r.json(await x.getCategories({locationId:q.params.locationId}))}catch(e){r.status(502).json({ok:false,error:e.message})}});
app.get("/api/stores/:store/locations/:locationId/products",async(q,r)=>{const x=a(q.params.store);if(!x)return r.status(404).json({ok:false,error:"Enseigne inconnue"});try{r.json(await x.getProducts({locationId:q.params.locationId,query:q.query.q||"",category:q.query.category||""}))}catch(e){r.status(502).json({ok:false,error:e.message})}});
app.get("/api/smoke",async(q,r)=>{const query=q.query.q||"lait",results={};for(const [id,x] of Object.entries(adapters)){try{results[id]=await x.getProducts({locationId:`${id}-official-selection`,query})}catch(e){results[id]={store:id,verified:false,products:[],error:e.message}}}r.json({ok:true,query,results})});
app.listen(PORT,"0.0.0.0",()=>console.log(`Budget Courses Server listening on ${PORT}`));
