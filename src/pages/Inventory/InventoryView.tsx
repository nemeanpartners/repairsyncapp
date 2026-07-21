import React, { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, limit, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Package, Search, Plus, Filter, AlertCircle, Edit, Trash2, Tag, Box, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InventoryView() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    price: "",
    cost: "",
    stock_quantity: "",
    reorder_level: ""
  });

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, "inventory_products"), orderBy("name", "asc"), limit(500));
      const snap = await getDocs(q);
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
     if (!searchQuery.trim()) return products;
     const lowerQ = searchQuery.toLowerCase();
     return products.filter(p =>
       (String(p.name || "")).toLowerCase().includes(lowerQ) ||
       (String(p.sku || "")).toLowerCase().includes(lowerQ) ||
       (String(p.category || "")).toLowerCase().includes(lowerQ)
     );
  }, [products, searchQuery]);

  const handleOpenModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        category: product.category || "",
        price: product.price || "",
        cost: product.cost || "",
        stock_quantity: product.stock_quantity || "",
        reorder_level: product.reorder_level || ""
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        sku: "",
        category: "",
        price: "",
        cost: "",
        stock_quantity: "",
        reorder_level: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const dataToSave = {
        name: formData.name,
        sku: formData.sku,
        category: formData.category,
        price: Number(formData.price) || 0,
        cost: Number(formData.cost) || 0,
        stock_quantity: Number(formData.stock_quantity) || 0,
        reorder_level: Number(formData.reorder_level) || 0,
        updated_at: serverTimestamp(),
      };

      if (editingProduct) {
        await updateDoc(doc(db, "inventory_products", editingProduct.id), dataToSave);
      } else {
        await addDoc(collection(db, "inventory_products"), {
          ...dataToSave,
          created_at: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Failed to save product.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        await deleteDoc(doc(db, "inventory_products", id));
        fetchProducts();
      } catch (error) {
        console.error("Error deleting product:", error);
      }
    }
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center items-center h-full text-zinc-500">Loading inventory...</div>;
  }

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50/50">
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-zinc-200 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
           <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Inventory Management</h1>
           <p className="text-zinc-500 text-sm mt-1">Manage products, stock levels, and pricing</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button className="bg-zinc-900 text-white shadow-sm border border-zinc-800 flex-1 md:flex-none" onClick={() => handleOpenModal()}>
             <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>
      </div>
      
      <div className="p-4 md:p-8 flex-1 overflow-auto pb-20 md:pb-8">
        <div className="max-w-7xl mx-auto bg-white border border-zinc-200 shadow-sm rounded-2xl overflow-hidden">
           
           {/* Search Box */}
           <div className="p-4 border-b border-zinc-100 flex items-center bg-zinc-50/30">
             <Search className="w-4 h-4 text-zinc-400 mr-2" />
             <input 
               type="text" 
               placeholder="Search by product name, SKU, or category..." 
               className="flex-1 outline-none text-sm bg-transparent"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
           </div>

           {/* List */}
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-zinc-50/50 border-b border-zinc-100">
                   <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Product</th>
                   <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">SKU</th>
                   <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Price</th>
                   <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Cost</th>
                   <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">In Stock</th>
                   <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-zinc-100">
                 {filteredProducts.map((p) => {
                    const isLowStock = p.stock_quantity <= p.reorder_level;
                    return (
                      <tr key={p.id} className="hover:bg-zinc-50/80 transition-colors group">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 shrink-0 shadow-sm group-hover:bg-white transition-colors">
                              <Box className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-zinc-900 text-sm">{p.name || "Unnamed Product"}</p>
                              {p.category && <p className="text-xs text-zinc-500 font-medium mt-0.5">{p.category}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-mono bg-zinc-100 border border-zinc-200 px-2 py-1 rounded text-zinc-700 font-medium text-xs tracking-tight">
                            {p.sku || "N/A"}
                          </span>
                        </td>
                        <td className="p-4 text-right font-semibold text-zinc-900 text-sm">
                          ${Number(p.price || 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-medium text-zinc-500 text-sm">
                          ${Number(p.cost || 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isLowStock && <AlertCircle className="w-4 h-4 text-amber-500" />}
                            <Badge className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wide border-none ${isLowStock ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {p.stock_quantity || 0}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                           <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleOpenModal(p)}>
                               <Edit className="w-4 h-4" />
                             </Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(p.id)}>
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </div>
                        </td>
                      </tr>
                    );
                 })}
                 {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-zinc-400">
                         <div className="flex flex-col items-center justify-center">
                           <Package className="w-10 h-10 mb-3 opacity-20" />
                           <p className="font-medium text-sm">No products found.</p>
                         </div>
                      </td>
                    </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white rounded-2xl border-zinc-200">
          <DialogHeader className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold text-zinc-700">Product Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. iPhone 13 Pro Screen Replacement" className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku" className="text-sm font-semibold text-zinc-700">SKU / Item Code</Label>
                  <Input id="sku" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} placeholder="IPH13P-SCR" className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-semibold text-zinc-700">Category</Label>
                  <Input id="category" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} placeholder="Screens" className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-semibold text-zinc-700">Retail Price ($)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input id="price" type="number" min="0" step="0.01" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} placeholder="0.00" className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost" className="text-sm font-semibold text-zinc-700">Cost Price ($)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input id="cost" type="number" min="0" step="0.01" value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})} placeholder="0.00" className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pl-9" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock_quantity" className="text-sm font-semibold text-zinc-700">Stock Quantity</Label>
                  <Input id="stock_quantity" type="number" min="0" value={formData.stock_quantity} onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})} placeholder="0" className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reorder_level" className="text-sm font-semibold text-zinc-700">Reorder Alert Level</Label>
                  <Input id="reorder_level" type="number" min="0" value={formData.reorder_level} onChange={(e) => setFormData({...formData, reorder_level: e.target.value})} placeholder="e.g. 5" className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-medium text-zinc-600">Cancel</Button>
            <Button onClick={handleSave} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">
              {editingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
