import { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";

const PRESET_PRODUCTS = [
  { code: 'REP-SCR-IP14', description: 'iPhone 14 Screen Replacement', price: 189 },
  { code: 'REP-BATT-IP14', description: 'iPhone 14 Battery Replacement', price: 89 },
  { code: 'REP-SCR-SAM23', description: 'Samsung S23 Screen Replacement', price: 219 },
  { code: 'REP-BATT-SAM23', description: 'Samsung S23 Battery Replacement', price: 99 },
  { code: 'DIAG-001', description: 'Standard Diagnostic Fee', price: 49 },
  { code: 'DATA-001', description: 'Data Recovery Level 1', price: 149 },
  { code: 'LABOR-HR', description: 'General Labor (per hour)', price: 90 },
  { code: 'PRO-GLASS-01', description: 'Tempered Glass Protector', price: 25 },
  { code: 'ACC-CHG-20W', description: '20W Fast Charger Block', price: 29 },
  { code: 'ACC-CBL-USBC', description: 'USB-C to USB-C Cable 1m', price: 19 },
  { code: 'WATER-001', description: 'Water Damage Assessment', price: 55 },
];

const PRESET_SUPPLIERS = [
  'MobileSentrix',
  'InjuredGadgets',
  'iFixit',
  'Amazon',
  'eBay',
];

export function useCatalogAndSuppliers() {
  const [products, setProducts] = useState<any[]>(PRESET_PRODUCTS);
  const [suppliers, setSuppliers] = useState<any[]>(PRESET_SUPPLIERS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let dbProducts: any[] = [];
    let dbInventory: any[] = [];
    let dbSuppliers: any[] = [];
    
    let loadedProducts = false;
    let loadedInventory = false;
    let loadedSuppliers = false;

    const updateState = () => {
       const mappedInventory = dbInventory.map(inv => ({
         id: inv.id,
         code: inv.sku || 'N/A',
         description: inv.name,
         price: Number(inv.price) || 0
       }));

       const combinedProducts = [...PRESET_PRODUCTS, ...dbProducts, ...mappedInventory];

       const allProducts = combinedProducts.reduce((acc: any[], curr) => {
          if (!acc.some(p => p.description?.toLowerCase() === curr.description?.toLowerCase())) {
            acc.push(curr);
          }
          return acc;
       }, []);

       const allSuppliers = [...PRESET_SUPPLIERS, ...dbSuppliers].reduce((acc: any[], curr) => {
          if (!acc.some(s => s?.toLowerCase() === curr?.toLowerCase())) {
            acc.push(curr);
          }
          return acc;
       }, []);

       setProducts(allProducts);
       setSuppliers(allSuppliers);
       
       if (loadedProducts && loadedInventory && loadedSuppliers) {
         setIsLoading(false);
       }
    };

    const unsubProd = onSnapshot(query(collection(db, "product_catalog")), (snap) => {
       dbProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       loadedProducts = true;
       updateState();
    }, (error) => {
       console.error("Failed to load product catalog:", error);
       loadedProducts = true;
       updateState();
    });

    const unsubInv = onSnapshot(query(collection(db, "inventory_products")), (snap) => {
       dbInventory = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       loadedInventory = true;
       updateState();
    }, (error) => {
       console.error("Failed to load inventory products:", error);
       loadedInventory = true;
       updateState();
    });

    const unsubSupp = onSnapshot(query(collection(db, "suppliers")), (snap) => {
       dbSuppliers = snap.docs.map(d => d.data().name);
       loadedSuppliers = true;
       updateState();
    }, (error) => {
       console.error("Failed to load suppliers:", error);
       loadedSuppliers = true;
       updateState();
    });

    return () => {
      unsubProd();
      unsubInv();
      unsubSupp();
    };
  }, []);

  return { products, suppliers, isLoading };
}
