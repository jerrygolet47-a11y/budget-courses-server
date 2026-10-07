const {clean,norm,filter,get,jsonLd}=require("../lib");
const STORE="intermarche", NAME="Intermarch\u00e9", OFFICIAL="https://www.intermarche.com/", HOME="https://www.intermarche.com/";
function base(x){return Object.assign({store:STORE,locationId:null,query:"",category:"",sourceUrl:OFFICIAL,updatedAt:new Date().toISOString()},x);}
async function getLocations({postalCode="",city=""}){
  const q=clean(postalCode||city);
  return {
    store:STORE,postalCode,city,selectionRequired:true,sourceUrl:OFFICIAL,
    locations:[{
      id:`${STORE}-official-selection`,
      name:NAME,postalCode:postalCode||null,city:city||null,address:null,
      mode:"official",officialUrl:HOME,officialSelectionUrl:OFFICIAL,
      requiresOfficialSelection:true
    }]
  };
}
async function getCategories({locationId}){
  return {store:STORE,locationId,categories:[],sourceUrl:OFFICIAL,
    message:"Les catégories dépendent du catalogue officiel du point sélectionné."};
}
async function getProducts({locationId,query="",category=""}){
  if(!locationId) throw new Error("locationId obligatoire");
  return base({
    locationId,
    query,
    category,
    verified:false,
    products:[],
    requiresOfficialSelection:true,
    officialSelectionUrl:OFFICIAL,
    message:"Cette enseigne lie le catalogue et les prix au magasin/Drive sélectionné dans son parcours officiel. Aucun prix n'est inventé."
  });
}
module.exports={id:STORE,name:NAME,getLocations,getCategories,getProducts};
