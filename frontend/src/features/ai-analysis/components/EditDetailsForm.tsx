import React, { useState } from "react";

const CATEGORIES = ["Bags & Luggage", "Electronics", "Clothing", "Accessories", "Keys", "Wallet", "Other"];

const EditDetailsForm: React.FC = () => {
  const [itemName,     setItemName]     = useState("Black Nike Backpack");
  const [category,     setCategory]     = useState("Bags & Luggage");
  const [description,  setDescription]  = useState(
    "Black Nike branded backpack with multiple compartments and padded straps. Last seen with a small keychain attached to the front zipper."
  );

  const inputCls = "w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-bold text-gray-900 text-base">Edit Details</h2>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Item Name</label>
        <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className={inputCls} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Category</label>
        <div className="relative">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▼</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${inputCls} resize-y`} />
      </div>
    </div>
  );
};

export default EditDetailsForm;
