import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CatalogSettingsForm() {
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Product State
  const [newProductCode, setNewProductCode] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  
  // New Supplier State
  const [newSupplierName, setNewSupplierName] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const prodSnap = await getDocs(collection(db, "product_catalog"));
      const suppSnap = await getDocs(collection(db, "suppliers"));
      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSuppliers(suppSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load catalog data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddProduct = async () => {
    if (!newProductDesc.trim()) return;
    try {
      await addDoc(collection(db, "product_catalog"), {
        code: newProductCode || "",
        description: newProductDesc,
        price: Number(newProductPrice) || 0,
        created_at: serverTimestamp(),
      });
      setNewProductCode("");
      setNewProductDesc("");
      setNewProductPrice("");
      fetchData();
      toast.success("Product added");
    } catch(e) {
      toast.error("Failed to add product");
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      await addDoc(collection(db, "suppliers"), {
        name: newSupplierName,
        created_at: serverTimestamp(),
      });
      setNewSupplierName("");
      fetchData();
      toast.success("Supplier added");
    } catch(e) {
      toast.error("Failed to add supplier");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, "product_catalog", id));
      fetchData();
      toast.success("Product deleted");
    } catch(e) {
      toast.error("Failed to delete product");
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      await deleteDoc(doc(db, "suppliers", id));
      fetchData();
      toast.success("Supplier deleted");
    } catch(e) {
      toast.error("Failed to delete supplier");
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-12 text-zinc-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-900">Catalogs & Suppliers</h2>
        <p className="text-sm text-zinc-500">Manage your product list and suppliers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Catalog</CardTitle>
          <CardDescription>Manage your predefined items and pricing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center mb-4">
            <Input placeholder="Code" value={newProductCode} onChange={e => setNewProductCode(e.target.value)} className="w-1/4" />
            <Input placeholder="Description (Required)" value={newProductDesc} onChange={e => setNewProductDesc(e.target.value)} className="flex-1" />
            <Input type="number" placeholder="Price" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} className="w-1/4" />
            <Button onClick={handleAddProduct} disabled={!newProductDesc.trim()}><Plus className="w-4 h-4 mr-2"/> Add</Button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {products.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg bg-zinc-50/50 hover:bg-zinc-50">
                <div className="flex-1 flex gap-4">
                  <span className="font-mono text-zinc-500 text-sm font-bold w-24">{p.code}</span>
                  <span className="font-semibold text-zinc-800">{p.description}</span>
                  <span className="text-emerald-600 font-bold ml-auto mr-4">${p.price}</span>
                </div>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteProduct(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {products.length === 0 && <div className="text-center p-4 text-zinc-500 text-sm">No products found.</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suppliers</CardTitle>
          <CardDescription>Manage your list of default suppliers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center mb-4">
            <Input placeholder="Supplier Name" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className="flex-1" />
            <Button onClick={handleAddSupplier} disabled={!newSupplierName.trim()}><Plus className="w-4 h-4 mr-2"/> Add</Button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {suppliers.map(s => (
               <div key={s.id} className="flex justify-between items-center p-3 border rounded-lg bg-zinc-50/50 hover:bg-zinc-50">
                <div className="font-semibold text-zinc-800">{s.name}</div>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteSupplier(s.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {suppliers.length === 0 && <div className="text-center p-4 text-zinc-500 text-sm">No suppliers found.</div>}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
