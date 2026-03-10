"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Edit2, Trash2, Power, EyeOff, Save, X, ChevronUp, ChevronDown } from "lucide-react";

export default function AdminMenuManager() {
    const [categories, setCategories] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    // Form States
    const [categoryName, setCategoryName] = useState("");

    const [itemName, setItemName] = useState("");
    const [itemDesc, setItemDesc] = useState("");
    const [itemPrice, setItemPrice] = useState("");
    const [itemImage, setItemImage] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        // Fetch Categories
        const { data: cats, error: catErr } = await supabase.from("menu_categories").select("*").order("sort_order", { ascending: true });
        if (catErr) console.error("Category fetch error:", catErr);
        if (cats) {
            setCategories(cats);
            if (!selectedCategoryId && cats.length > 0) {
                setSelectedCategoryId(cats[0].id);
            }
        }
        // Fetch All Items
        const { data: mnItms, error: itemErr } = await supabase.from("menu_items").select("*").order("sort_order", { ascending: true });
        if (itemErr) console.error("Item fetch error:", JSON.stringify(itemErr, null, 2));
        if (mnItms) setItems(mnItms);

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- CATEGORY CRUD ---
    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryName.trim()) return;

        const newSortOrder = categories.length > 0
            ? Math.max(...categories.map(c => c.sort_order || 0)) + 1
            : 1;

        const { error } = await supabase.from("menu_categories").insert({
            name: categoryName,
            sort_order: newSortOrder
        });

        if (!error) {
            setCategoryName("");
            setIsCategoryModalOpen(false);
            fetchData();
        } else {
            alert("Failed to add category");
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm("Are you sure? This will delete the category and ALL items inside it!")) return;
        const { error } = await supabase.from("menu_categories").delete().eq("id", id);
        if (!error) {
            if (selectedCategoryId === id) setSelectedCategoryId(null);
            fetchData();
        } else {
            alert("Failed to delete category");
        }
    };

    // --- ITEM CRUD ---
    const openAddItemModal = () => {
        setEditingItem(null);
        setItemName("");
        setItemDesc("");
        setItemPrice("");
        setItemImage("");
        setIsItemModalOpen(true);
    };

    const openEditItemModal = (item: any) => {
        setEditingItem(item);
        setItemName(item.name);
        setItemDesc(item.description || "");
        setItemPrice(item.price.toString());
        setItemImage(item.image_url || "");
        setImageFile(null);
        setIsItemModalOpen(true);
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemName.trim() || !itemPrice || !selectedCategoryId) return;

        setIsUploading(true);
        let finalImageUrl = itemImage;

        // 1. Upload new image if a new file was selected
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const filePath = `${selectedCategoryId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('menu_images')
                .upload(filePath, imageFile);

            if (uploadError) {
                alert("Error uploading image: " + uploadError.message);
                setIsUploading(false);
                return;
            }

            // Get Public URL
            const { data: publicUrlData } = supabase.storage
                .from('menu_images')
                .getPublicUrl(filePath);

            finalImageUrl = publicUrlData.publicUrl;

            // 2. Cleanup old image if replacing
            if (editingItem && editingItem.image_url) {
                // Extract filepath from public URL
                const oldUrl = new URL(editingItem.image_url);
                const pathParts = oldUrl.pathname.split('/menu_images/');
                if (pathParts.length > 1) {
                    const oldFilePath = pathParts[1];
                    // Fire and forget delete
                    supabase.storage.from('menu_images').remove([oldFilePath]);
                }
            }
        }

        const itemData: any = {
            category_id: selectedCategoryId,
            name: itemName,
            description: itemDesc,
            price: parseFloat(itemPrice),
            image_url: finalImageUrl
        };

        let error;
        if (editingItem) {
            const res = await supabase.from("menu_items").update(itemData).eq("id", editingItem.id);
            error = res.error;
        } else {
            itemData.sort_order = visibleItems.length;
            const res = await supabase.from("menu_items").insert(itemData);
            error = res.error;
        }

        setIsUploading(false);

        if (!error) {
            setIsItemModalOpen(false);
            fetchData();
        } else {
            alert("Failed to save item: " + error.message);
        }
    };

    const handleToggleAvailability = async (item: any) => {
        const { error } = await supabase
            .from("menu_items")
            .update({ is_available: !item.is_available })
            .eq("id", item.id);

        if (!error) fetchData();
    };

    const handleDeleteItem = async (item: any) => {
        if (!confirm("Delete this item permanently?")) return;

        const { error } = await supabase.from("menu_items").delete().eq("id", item.id);

        if (!error) {
            // Delete associated image
            if (item.image_url) {
                try {
                    const oldUrl = new URL(item.image_url);
                    const pathParts = oldUrl.pathname.split('/menu_images/');
                    if (pathParts.length > 1) {
                        supabase.storage.from('menu_images').remove([pathParts[1]]);
                    }
                } catch (e) { }
            }
            fetchData();
        } else {
            alert("Failed to delete item: " + error.message);
        }
    };


    const handleReorderCategory = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === categories.length - 1) return;

        const newCategories = [...categories];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        const [moved] = newCategories.splice(index, 1);
        newCategories.splice(newIndex, 0, moved);

        const updated = newCategories.map((c, i) => ({ ...c, sort_order: i }));
        setCategories(updated);

        await Promise.all(
            updated.map((cat, idx) =>
                supabase.from("menu_categories").update({ sort_order: idx }).eq("id", cat.id)
            )
        );
    };

    const handleReorderItem = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === visibleItems.length - 1) return;

        const newItems = [...visibleItems];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        const [moved] = newItems.splice(index, 1);
        newItems.splice(newIndex, 0, moved);

        const updatedSortMap = newItems.map((n, i) => ({ ...n, sort_order: i }));

        setItems(prev => prev.map(p => {
            const found = updatedSortMap.find(u => u.id === p.id);
            return found ? found : p;
        }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

        await Promise.all(
            updatedSortMap.map((item, idx) =>
                supabase.from("menu_items").update({ sort_order: idx }).eq("id", item.id)
            )
        );
    };


    const visibleItems = items.filter(item => item.category_id === selectedCategoryId);

    return (
        <div className="p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h1 className="text-3xl font-bold text-gray-900">Menu Manager</h1>
                    <p className="text-gray-500 mt-1">Add, edit, and organize your cafe's offerings.</p>
                </header>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* LEFT COLUMN: Categories */}
                    <div className="w-full md:w-1/3 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800">Categories</h2>
                            <button
                                onClick={() => setIsCategoryModalOpen(true)}
                                className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition"
                                title="Add Category"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        {loading && categories.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">Loading...</div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                {categories.map((cat, idx) => (
                                    <div
                                        key={cat.id}
                                        className={`group flex items-center justify-between p-4 cursor-pointer border-b last:border-0 transition-colors ${selectedCategoryId === cat.id ? "bg-blue-50 border-l-4 border-l-blue-600" : "hover:bg-gray-50 border-l-4 border-l-transparent"
                                            }`}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition">
                                                <button onClick={(e) => { e.stopPropagation(); handleReorderCategory(idx, 'up'); }} disabled={idx === 0} className="text-gray-400 hover:text-blue-600 disabled:opacity-30 p-0.5"><ChevronUp size={16} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleReorderCategory(idx, 'down'); }} disabled={idx === categories.length - 1} className="text-gray-400 hover:text-blue-600 disabled:opacity-30 p-0.5"><ChevronDown size={16} /></button>
                                            </div>
                                            <span className={`font-medium ${selectedCategoryId === cat.id ? "text-blue-900" : "text-gray-700"}`}>
                                                {cat.name}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                                            className="text-gray-400 hover:text-red-600 p-1"
                                            title="Delete Category"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {categories.length === 0 && (
                                    <div className="p-6 text-center text-gray-500 text-sm">No categories yet.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Items */}
                    <div className="w-full md:w-2/3 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800">
                                {categories.find(c => c.id === selectedCategoryId)?.name || "Items"}
                            </h2>
                            {selectedCategoryId && (
                                <button
                                    onClick={openAddItemModal}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition"
                                >
                                    <Plus size={18} /> Add Item
                                </button>
                            )}
                        </div>

                        {loading && items.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">Loading items...</div>
                        ) : !selectedCategoryId ? (
                            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
                                Select or create a category to view items.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {visibleItems.map((item, idx) => (
                                    <div key={item.id} className={`bg-white rounded-xl shadow-sm border p-4 flex gap-4 transition-opacity ${!item.is_available ? "opacity-60" : ""}`}>

                                        {/* Sorting Actions */}
                                        <div className="flex flex-col gap-1 items-center justify-center border-r pr-4 mr-1">
                                            <button onClick={(e) => { e.stopPropagation(); handleReorderItem(idx, 'up'); }} disabled={idx === 0} className="p-1 text-gray-400 hover:text-blue-600 bg-gray-50 rounded hover:bg-blue-50 disabled:opacity-30 transition"><ChevronUp size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleReorderItem(idx, 'down'); }} disabled={idx === visibleItems.length - 1} className="p-1 text-gray-400 hover:text-blue-600 bg-gray-50 rounded hover:bg-blue-50 disabled:opacity-30 transition"><ChevronDown size={16} /></button>
                                        </div>

                                        {/* Image Box */}
                                        <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-gray-400 text-xs">No img</span>
                                            )}
                                            {!item.is_available && (
                                                <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center backdrop-blur-sm">
                                                    <span className="text-white text-xs font-bold uppercase tracking-wider rotate-[-15deg] border-2 border-white px-2 py-1 rounded">Out of Stock</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-grow flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-bold text-lg text-gray-900">{item.name}</h3>
                                                    <span className="font-bold text-lg text-blue-700">₹{item.price.toFixed(2)}</span>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2 justify-end mt-4 border-t pt-3">
                                                <button
                                                    onClick={() => handleToggleAvailability(item)}
                                                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition ${item.is_available ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-green-100 text-green-700 hover:bg-green-200"
                                                        }`}
                                                >
                                                    {item.is_available ? <EyeOff size={14} /> : <Power size={14} />}
                                                    {item.is_available ? "Mark Out of Stock" : "Mark Available"}
                                                </button>
                                                <button
                                                    onClick={() => openEditItemModal(item)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-sm font-medium transition"
                                                >
                                                    <Edit2 size={14} /> Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteItem(item)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-medium transition"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {visibleItems.length === 0 && (
                                    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
                                        No items in this category yet.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="font-bold text-xl">Add Category</h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAddCategory} className="p-6">
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Category Name</label>
                                <input
                                    type="text"
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                    placeholder="e.g. Hot Coffees"
                                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    required autoFocus
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg">Save Category</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isItemModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-xl">{editingItem ? "Edit Item" : "Add New Item"}</h3>
                            <button onClick={() => setIsItemModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSaveItem} className="p-6 overflow-y-auto flex-grow flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                                <input
                                    type="text" value={itemName} onChange={(e) => setItemName(e.target.value)}
                                    placeholder="e.g. Classic Cappuccino"
                                    className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" required
                                />
                            </div>
                            <div className="flex gap-4 mb-4">
                                <div className="w-1/2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                                    <input
                                        type="number" step="0.01" min="0" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                                        placeholder="120.00"
                                        className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" required
                                    />
                                </div>
                                <div className="w-1/2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image (Optional)</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                setImageFile(e.target.files[0]);
                                            }
                                        }}
                                        className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    {itemImage && !imageFile && (
                                        <p className="text-xs text-green-600 mt-1 truncate">Current: {itemImage.split('/').pop()?.substring(0, 20)}...</p>
                                    )}
                                    {imageFile && (
                                        <p className="text-xs text-blue-600 mt-1 truncate">Selected: {imageFile.name}</p>
                                    )}
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                                <textarea
                                    value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} rows={3}
                                    placeholder="Rich espresso with steamed milk foam..."
                                    className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                                />
                            </div>

                            <div className="flex gap-3 justify-end mt-4 pt-4 border-t">
                                <button type="button" onClick={() => setIsItemModalOpen(false)} disabled={isUploading} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition disabled:opacity-50">Cancel</button>
                                <button type="submit" disabled={isUploading} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
                                    {isUploading ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Uploading...
                                        </>
                                    ) : (
                                        <><Save size={18} /> {editingItem ? "Update Item" : "Create Item"}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
