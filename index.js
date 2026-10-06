const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors()); app.use(express.json());
const stores=[
{id:"auchan",name:"Auchan",officialUrl:"https://www.auchan.fr/"},{id:"intermarche",name:"Intermarché",officialUrl:"https://www.intermarche.com/"},{id:"superu",name:"Super U",officialUrl:"https://www.coursesu.com/"},{id:"aldi",name:"ALDI",officialUrl:"https://www.aldi.fr/"},{id:"lidl",name:"Lidl",officialUrl:"https://www.lidl.fr/"},{id:"carrefour",name:"Carrefour",officialUrl:"https://www.carrefour.fr/"},{id:"leclerc",name:"E.Leclerc",officialUrl:"https://www.leclercdrive.fr/"}];
const categories=["Fruits & légumes","Viandes & poissons","Crèmerie","Charcuterie & traiteur","Surgelés","Bébé","Épicerie salée","Épicerie sucrée","Boissons","Pains & pâtisseries","Bio & écologie","Entretien","Maison","Animalerie"];
const products=[["milk","Lait","Crèmerie"],["pasta","Pâtes","Épicerie salée"],["rice","Riz","Épicerie salée"],["eggs","Œufs","Crèmerie"],["apples","Pommes","Fruits & légumes"],["potatoes","Pommes de terre","Fruits & légumes"],["chicken","Poulet","Viandes & poissons"],["water","Eau","Boissons"]];
app.get("/api/health",(_req,res)=>res.json({ok:true,service:"budget-courses-server",time:new Date().toISOString()}));
app.get("/api/stores",(_req,res)=>res.json(stores));
app.get("/api/stores/:store/locations",(req,res)=>{const s=stores.find(x=>x.id===req.params.store);if(!s)return res.status(404).json({error:"store_not_found"});res.json([{id:s.id+"-official",storeId:s.id,name:s.name+" — recherche officielle",postalCode:String(req.query.postalCode||""),city:String(req.query.city||""),verified:false,sourceUrl:s.officialUrl,message:"Sélectionnez votre magasin/Drive sur le site officiel pour les prix et disponibilités locaux."}])});
app.get("/api/stores/:store/locations/:locationId/categories",(req,res)=>{if(!stores.find(x=>x.id===req.params.store))return res.status(404).json({error:"store_not_found"});res.json(categories)});
app.get("/api/stores/:store/locations/:locationId/products",(req,res)=>{const s=stores.find(x=>x.id===req.params.store);if(!s)return res.status(404).json({error:"store_not_found"});const q=String(req.query.q||"").trim().toLowerCase(),c=String(req.query.category||"").trim();const list=products.map(([id,name,category])=>({id,name,category,price:null,currency:"EUR",available:null,sourceUrl:s.officialUrl,updatedAt:null})).filter(p=>(!q||p.name.toLowerCase().includes(q))&&(!c||p.category===c));res.json({store:s.id,locationId:req.params.locationId,verified:false,products:list,message:"Prix officiels locaux à confirmer via le magasin/Drive sélectionné.",sourceUrl:s.officialUrl,updatedAt:null})});
app.listen(PORT,()=>console.log(`Budget Courses server listening on ${PORT}`));
