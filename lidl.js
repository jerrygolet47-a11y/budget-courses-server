const {clean,norm,filter,get,jsonLd}=require("../lib");
const STORE="lidl", NAME="Lidl", OFFICIAL="https://www.lidl.fr/online", HOME="https://www.lidl.fr/";
function base(x){return Object.assign({store:STORE,locationId:null,query:"",category:"",sourceUrl:OFFICIAL,updatedAt:new Date().toISOString()},x);}
async function getLocations({postalCode="",city=""}){
  const q=clean(postalCode||city);
  return {
    store:STORE,postalCode,city,selectionRequired:true,sourceUrl:OFFICIAL,
    locations:[{
      id:`${STORE}-official-selection`,
      name:NAME,postalCode:postalCode||null,city:city||null,address:null,
      mode:"official",officialUrl:HOME,officialSelectionUrl:OFFICIAL,
      requiresOfficialSelection:false
    }]
  };
}
async function getCategories({locationId}){
  return {store:STORE,locationId,categories:[],sourceUrl:OFFICIAL,
    message:"Les catégories dépendent du catalogue officiel du point sélectionné."};
}
async function getProducts({locationId,query="",category=""}){
  if(!locationId) throw new Error("locationId obligatoire");
  try {
    const html=await get(OFFICIAL);
    const products=filter(jsonLd(html,OFFICIAL),query);
    const verified=products.some(p=>p.verified && p.price!=null);
    return base({locationId,query,category,verified,products:products.slice(0,100)});
  } catch(e) {
    return base({locationId,query,category,verified:false,products:[],message:"Source officielle temporairement inaccessible.",error:e.message});
  }
}
module.exports={id:STORE,name:NAME,getLocations,getCategories,getProducts};
