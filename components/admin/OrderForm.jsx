"use client";

import { useState, useEffect, useRef } from "react";
import {
    X,
    Save,
    ShoppingCart,
    User,
    MapPin,
    Trash2,
    Search,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import Image from "next/image";
import { toast } from "sonner";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

export default function OrderForm({ onCancel, onSuccess }) {
    const { get, post } = useAuthenticatedFetch();

    const [products, setProducts] = useState([]);
    // selectedItems: { key, product, variant (or null), quantity, price }
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [productsLoading, setProductsLoading] = useState(true);
    const [openVariantPicker, setOpenVariantPicker] = useState(null); // product.id

    const [customerPhone, setCustomerPhone] = useState("");
    const [orderStatus, setOrderStatus] = useState("payment_pending");
    const [shippingAddressFullName, setShippingAddressFullName] = useState("");
    const [shippingAddressAddressLine1, setShippingAddressAddressLine1] = useState("");
    const [shippingAddressAddressLine2, setShippingAddressAddressLine2] = useState("");
    const [shippingAddressCity, setShippingAddressCity] = useState("");
    const [shippingAddressState, setShippingAddressState] = useState("");
    const [shippingAddressPostalCode, setShippingAddressPostalCode] = useState("");
    const [shippingAddressPhone, setShippingAddressPhone] = useState("");
    const [shippingAddressCountry, setShippingAddressCountry] = useState("India");
    const [notes, setNotes] = useState("");

    // Customer search
    const [customerSearchTerm, setCustomerSearchTerm] = useState("");
    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const customerDropdownRef = useRef(null);

    // Create new user
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [createUserPhone, setCreateUserPhone] = useState("");
    const [createUserName, setCreateUserName] = useState("");
    const [createUserEmail, setCreateUserEmail] = useState("");
    const [createUserLoading, setCreateUserLoading] = useState(false);
    const [createUserError, setCreateUserError] = useState("");

    const [error, setError] = useState({
        shippingAddressFullName: null,
        shippingAddressAddressLine1: null,
        shippingAddressCity: null,
        shippingAddressState: null,
        shippingAddressPostalCode: null,
        customerPhone: null,
        shippingAddressPhone: null,
        customer: null,
    });

    useEffect(() => { fetchProducts(); }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
                setShowCustomerDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (customerSearchTerm.length < 2) { setCustomers([]); return; }
        const timer = setTimeout(() => fetchCustomers(customerSearchTerm), 300);
        return () => clearTimeout(timer);
    }, [customerSearchTerm]);

    const fetchCustomers = async (search) => {
        try {
            setCustomersLoading(true);
            const response = await get("/api/users?limit=20", { requireAdmin: true });
            const data = await response.json();
            const filtered = (data.users || []).filter((u) => {
                const term = search.toLowerCase();
                return u.email?.toLowerCase().includes(term) || u.full_name?.toLowerCase().includes(term) || u.phone?.includes(term);
            });
            setCustomers(filtered.slice(0, 8));
        } catch { setCustomers([]); }
        finally { setCustomersLoading(false); }
    };

    const handleSelectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setCustomerSearchTerm(customer.email || "");
        setShowCustomerDropdown(false);
        if (customer.phone) setCustomerPhone(customer.phone.replace(/[^0-9]/g, ""));
        setError((prev) => ({ ...prev, customer: null }));
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreateUserError("");

        // Validate phone
        const cleaned = createUserPhone.replace(/[^0-9]/g, "");
        if (!cleaned) { setCreateUserError("Phone number is required"); return; }
        if (!cleaned.startsWith("91")) { setCreateUserError("Only +91 numbers allowed"); return; }
        const digits = cleaned.slice(2);
        if (digits.length !== 10) { setCreateUserError("Must be 10 digits after +91"); return; }
        const formattedPhone = `+91${digits}`;

        setCreateUserLoading(true);
        try {
            const response = await post("/api/users", {
                phone: formattedPhone,
                full_name: createUserName.trim() || undefined,
                email: createUserEmail.trim() || undefined,
            }, { requireAdmin: true });

            const data = await response.json();
            if (!response.ok) {
                setCreateUserError(data.error || "Failed to create user");
                return;
            }

            // Auto-select the newly created user
            const newUser = {
                id: data.user.id,
                email: data.user.email || "",
                full_name: data.user.full_name || createUserName.trim() || "",
                phone: formattedPhone,
            };
            handleSelectCustomer(newUser);
            setCustomerPhone(cleaned); // pre-fill customer phone
            setShowCreateUser(false);
            setCreateUserPhone("");
            setCreateUserName("");
            setCreateUserEmail("");
            toast.success("User created and selected");
        } catch (err) {
            setCreateUserError(err?.message || "Failed to create user");
        } finally {
            setCreateUserLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            setProductsLoading(true);
            const response = await get("/api/products?limit=100");
            const data = await response.json();
            setProducts(data.products || []);
        } catch (err) { console.error(err); }
        finally { setProductsLoading(false); }
    };

    // Unique key per cart line: productId (no variant) or productId-variantSlug
    const makeKey = (productId, variantSlug) =>
        variantSlug ? `${productId}-${variantSlug}` : productId;

    const handleProductClick = (product) => {
        const hasVariants = product.variants && product.variants.length > 0;
        if (hasVariants) {
            setOpenVariantPicker((prev) => prev === product.id ? null : product.id);
        } else {
            const key = makeKey(product.id, null);
            const exists = selectedItems.some((i) => i.key === key);
            if (exists) {
                setSelectedItems((prev) => prev.filter((i) => i.key !== key));
            } else {
                setSelectedItems((prev) => [...prev, { key, product, variant: null, quantity: 1, price: product.price }]);
            }
        }
    };

    const handleSelectVariant = (product, variant) => {
        const key = makeKey(product.id, variant.slug);
        const exists = selectedItems.some((i) => i.key === key);
        if (exists) {
            setSelectedItems((prev) => prev.filter((i) => i.key !== key));
        } else {
            setSelectedItems((prev) => [...prev, { key, product, variant, quantity: 1, price: variant.price }]);
        }
    };

    const handleRemoveItem = (key) =>
        setSelectedItems((prev) => prev.filter((i) => i.key !== key));

    const handleQuantityChange = (key, quantity) => {
        if (quantity <= 0) { handleRemoveItem(key); return; }
        setSelectedItems((prev) => prev.map((i) => i.key === key ? { ...i, quantity } : i));
    };

    const handleChange = (setter, key, value) => {
        setter(value);
        setError((prev) => ({ ...prev, [key]: null }));
    };

    const calculateOrderSummary = () => {
        const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const delivery_charge = selectedItems.length > 0 ? 50 : 0;
        const tax_amount = 0;
        return { subtotal, delivery_charge, tax_amount, total_amount: subtotal + delivery_charge };
    };

    const fmt = (amount) =>
        new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

    const validateForm = () => {
        let isValid = true;
        const newErrors = {
            shippingAddressFullName: null, shippingAddressAddressLine1: null,
            shippingAddressCity: null, shippingAddressState: null, shippingAddressPostalCode: null,
            customerPhone: null, shippingAddressPhone: null, customer: null,
        };

        if (!selectedCustomer) { newErrors.customer = "Please select a customer"; isValid = false; }

        const required = [
            { value: shippingAddressFullName, key: "shippingAddressFullName", message: "Full name is required" },
            { value: shippingAddressAddressLine1, key: "shippingAddressAddressLine1", message: "Address is required" },
            { value: shippingAddressCity, key: "shippingAddressCity", message: "City is required" },
            { value: shippingAddressState, key: "shippingAddressState", message: "State is required" },
            { value: shippingAddressPostalCode, key: "shippingAddressPostalCode", message: "Postal code is required" },
        ];
        required.forEach((f) => { if (!f.value?.trim()) { newErrors[f.key] = f.message; isValid = false; } });

        if (shippingAddressPostalCode && !/^[0-9]{6}$/.test(shippingAddressPostalCode)) {
            newErrors.shippingAddressPostalCode = "Must be 6 digits"; isValid = false;
        }

        const validatePhone = (num, key) => {
            const cleaned = num.replace(/[^0-9]/g, "");
            if (!cleaned) { newErrors[key] = "Phone is required"; return null; }
            if (!cleaned.startsWith("91")) { newErrors[key] = "Only +91 numbers allowed"; return null; }
            const digits = cleaned.slice(2);
            if (digits.length !== 10) { newErrors[key] = "Must be 10 digits"; return null; }
            return "+91" + digits;
        };

        const fp = validatePhone(customerPhone, "customerPhone");
        const fsp = validatePhone(shippingAddressPhone, "shippingAddressPhone");
        if (!fp || !fsp) isValid = false;

        setError(newErrors);
        return { isValid, formattedCustomerPhone: fp, formattedShippingPhone: fsp };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { isValid, formattedCustomerPhone, formattedShippingPhone } = validateForm();
            if (!isValid) { setLoading(false); return; }

            const orderSummary = calculateOrderSummary();
            const orderItems = selectedItems.map((item) => ({
                id: item.product.id,
                name: item.variant
                    ? `${item.product.name} (${item.variant.size_slug.toUpperCase()}${item.variant.color_slug ? ` / ${item.variant.color_slug}` : ""})`
                    : item.product.name,
                price: item.price,
                quantity: item.quantity,
                image: item.product.images?.[0] || "",
                product_details: item.variant
                    ? { size: item.variant.size_slug, color: item.variant.color_slug, sku: item.variant.slug }
                    : undefined,
            }));

            const address = {
                full_name: shippingAddressFullName,
                address_line_1: shippingAddressAddressLine1,
                address_line_2: shippingAddressAddressLine2,
                city: shippingAddressCity,
                state: shippingAddressState,
                postal_code: shippingAddressPostalCode,
                country: shippingAddressCountry,
                phone: formattedShippingPhone,
            };

            const response = await post("/api/orders", {
                user_id: selectedCustomer.id,
                customer_email: selectedCustomer.email,
                customer_phone: formattedCustomerPhone,
                shipping_address: address,
                billing_address: address,
                items: orderItems,
                ...orderSummary,
                currency: "INR",
                status: orderStatus,
                notes: notes || undefined,
            }, { requireAdmin: true });

            if (response.ok) {
                toast.success("Order created!");
                await onSuccess();
            }
        } catch (err) {
            toast.error(err?.message || "Failed to create order");
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const orderSummary = calculateOrderSummary();
    const cartQty = selectedItems.reduce((s, i) => s + i.quantity, 0);

    const statusOptions = [
        { value: "payment_pending", label: "Payment Pending" },
        { value: "payment_confirmed", label: "Payment Confirmed" },
        { value: "processing", label: "Processing" },
        { value: "shipped", label: "Shipped" },
        { value: "delivered", label: "Delivered" },
        { value: "cancelled", label: "Cancelled" },
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 p-1 -ml-1 shrink-0">
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="text-lg font-bold text-gray-900">New Order</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* ── Customer ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <User className="h-4 w-4" /> Customer
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div ref={customerDropdownRef} className="relative">
                            <Label className="text-xs">Search Customer *</Label>
                            <div className="relative mt-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <Input
                                    placeholder="Name or email..."
                                    value={customerSearchTerm}
                                    onChange={(e) => {
                                        setCustomerSearchTerm(e.target.value);
                                        setSelectedCustomer(null);
                                        setShowCustomerDropdown(true);
                                        setError((prev) => ({ ...prev, customer: null }));
                                    }}
                                    onFocus={() => customerSearchTerm.length >= 2 && setShowCustomerDropdown(true)}
                                    className="pl-10 pr-9 h-9"
                                />
                                {selectedCustomer && (
                                    <button type="button"
                                        onClick={() => { setSelectedCustomer(null); setCustomerSearchTerm(""); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            {showCustomerDropdown && customerSearchTerm.length >= 2 && !selectedCustomer && (
                                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {customersLoading ? (
                                        <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                                    ) : customers.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-gray-500">No customers found</div>
                                    ) : customers.map((c) => (
                                        <button key={c.id} type="button"
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-0"
                                            onClick={() => handleSelectCustomer(c)}>
                                            <p className="text-sm font-medium">{c.full_name || "No name"}</p>
                                            <p className="text-xs text-gray-500 break-all">{c.email}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {error.customer && <p className="text-red-500 text-xs">{error.customer}</p>}
                        {selectedCustomer && (
                            <div className="bg-green-50 border border-green-200 rounded p-2.5">
                                <p className="text-xs font-medium text-green-800">{selectedCustomer.full_name || "No name"}</p>
                                <p className="text-xs text-green-700 break-all">{selectedCustomer.email || selectedCustomer.phone}</p>
                            </div>
                        )}

                        {/* Create new user toggle */}
                        {!selectedCustomer && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex-1 border-t border-gray-100" />
                                <button type="button"
                                    onClick={() => { setShowCreateUser(!showCreateUser); setCreateUserError(""); }}
                                    className="text-xs text-blue-600 hover:text-blue-700 shrink-0">
                                    {showCreateUser ? "Cancel" : "+ Create new user"}
                                </button>
                                <div className="flex-1 border-t border-gray-100" />
                            </div>
                        )}

                        {/* Inline create user form */}
                        {showCreateUser && !selectedCustomer && (
                            <form onSubmit={handleCreateUser} className="bg-gray-50 rounded-lg p-3 space-y-2.5 border border-gray-200">
                                <p className="text-xs font-medium text-gray-700">New User</p>
                                <div>
                                    <Label className="text-xs">Phone * <span className="text-gray-400 font-normal">(India +91)</span></Label>
                                    <div className="mt-1">
                                        <PhoneInput country="in" enableSearch={false} disableDropdown={true}
                                            value={createUserPhone}
                                            onChange={(phone) => { setCreateUserPhone(phone); setCreateUserError(""); }}
                                            placeholder="9876543210"
                                            className="rounded-sm outline-none phone-input-container border-0"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs">Full Name <span className="text-gray-400 font-normal">(optional)</span></Label>
                                    <Input className="mt-1 h-9" value={createUserName}
                                        onChange={(e) => setCreateUserName(e.target.value)}
                                        placeholder="Customer name" />
                                </div>
                                <div>
                                    <Label className="text-xs">Email <span className="text-gray-400 font-normal">(optional)</span></Label>
                                    <Input className="mt-1 h-9" type="email" value={createUserEmail}
                                        onChange={(e) => setCreateUserEmail(e.target.value)}
                                        placeholder="customer@email.com" />
                                </div>
                                {createUserError && <p className="text-red-500 text-xs">{createUserError}</p>}
                                <Button type="submit" size="sm" disabled={createUserLoading} className="w-full">
                                    {createUserLoading ? "Creating..." : "Create & Select User"}
                                </Button>
                            </form>
                        )}

                        <div>
                            <Label className="text-xs">Customer Phone *</Label>
                            <div className="mt-1">
                                <PhoneInput country="in" enableSearch={false} disableDropdown={true}
                                    value={customerPhone}
                                    onChange={(phone) => handleChange(setCustomerPhone, "customerPhone", phone)}
                                    placeholder="9876543210"
                                    className="rounded-sm outline-none phone-input-container border-0"
                                />
                            </div>
                            {error.customerPhone && <p className="text-red-500 text-xs mt-0.5">{error.customerPhone}</p>}
                        </div>

                        <div>
                            <Label className="text-xs">Order Status</Label>
                            <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)}
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Products ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-sm font-semibold">
                            <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Products</span>
                            {cartQty > 0 && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                    {cartQty} in cart
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input placeholder="Search products..." value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-9" />
                        </div>

                        {productsLoading ? (
                            <div className="py-8 text-center text-sm text-gray-500">Loading products...</div>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                                {filteredProducts.map((product) => {
                                    const hasVariants = product.variants && product.variants.length > 0;
                                    const isOpen = openVariantPicker === product.id;
                                    const noVariantKey = makeKey(product.id, null);
                                    const isDirectSelected = !hasVariants && selectedItems.some((i) => i.key === noVariantKey);
                                    const variantsInCart = hasVariants ? selectedItems.filter((i) => i.product.id === product.id) : [];
                                    const totalQtyInCart = isDirectSelected
                                        ? (selectedItems.find((i) => i.key === noVariantKey)?.quantity || 0)
                                        : variantsInCart.reduce((s, i) => s + i.quantity, 0);

                                    return (
                                        <div key={product.id}
                                            className={`border rounded-lg overflow-hidden ${totalQtyInCart > 0 ? "border-blue-300" : "border-gray-200"}`}>
                                            {/* Product row */}
                                            <button type="button" onClick={() => handleProductClick(product)}
                                                className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors">
                                                {product.images?.[0] ? (
                                                    <Image src={product.images[0]} alt={product.name}
                                                        width={44} height={44} className="rounded object-cover shrink-0" />
                                                ) : (
                                                    <div className="w-11 h-11 bg-gray-100 rounded flex items-center justify-center shrink-0">
                                                        <Package className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{product.name}</p>
                                                    <p className="text-xs text-blue-600 font-semibold">{fmt(product.price)}</p>
                                                    {hasVariants ? (
                                                        <p className="text-xs text-gray-400">{product.variants.length} size{product.variants.length !== 1 ? "s" : ""}</p>
                                                    ) : product.stock_quantity !== undefined && (
                                                        <p className="text-xs text-gray-400">Stock: {product.stock_quantity}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {totalQtyInCart > 0 && (
                                                        <span className="text-xs bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-medium">
                                                            {totalQtyInCart}
                                                        </span>
                                                    )}
                                                    {hasVariants && (
                                                        isOpen
                                                            ? <ChevronUp className="h-4 w-4 text-gray-400" />
                                                            : <ChevronDown className="h-4 w-4 text-gray-400" />
                                                    )}
                                                </div>
                                            </button>

                                            {/* Variant picker */}
                                            {hasVariants && isOpen && (
                                                <div className="border-t bg-gray-50 px-3 py-2.5">
                                                    <p className="text-xs text-gray-500 mb-2">Select size · tap to add/remove</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {product.variants.map((variant) => {
                                                            const key = makeKey(product.id, variant.slug);
                                                            const inCart = selectedItems.some((i) => i.key === key);
                                                            const outOfStock = variant.stock_quantity === 0;
                                                            return (
                                                                <button key={variant.slug} type="button"
                                                                    disabled={outOfStock}
                                                                    onClick={() => handleSelectVariant(product, variant)}
                                                                    className={`flex flex-col items-center px-3 py-1.5 rounded-md border text-xs font-medium transition-colors
                                                                        ${inCart
                                                                            ? "bg-blue-600 text-white border-blue-600"
                                                                            : outOfStock
                                                                                ? "bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed"
                                                                                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}>
                                                                    <span className="uppercase">{variant.size_slug}</span>
                                                                    <span className={`text-[10px] mt-0.5 ${inCart ? "text-blue-100" : "text-gray-400"}`}>
                                                                        {outOfStock ? "Out of stock" : `${variant.stock_quantity} left`}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {filteredProducts.length === 0 && (
                                    <div className="py-8 text-center text-sm text-gray-500">No products found</div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Cart ── */}
                {selectedItems.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">
                                Cart ({selectedItems.length} line{selectedItems.length !== 1 ? "s" : ""})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            {selectedItems.map((item) => (
                                <div key={item.key} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                                    {item.product.images?.[0] ? (
                                        <Image src={item.product.images[0]} alt={item.product.name}
                                            width={40} height={40} className="rounded object-cover shrink-0" />
                                    ) : (
                                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center shrink-0">
                                            <Package className="h-3.5 w-3.5 text-gray-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.product.name}</p>
                                        {item.variant && (
                                            <p className="text-xs text-gray-500 uppercase">
                                                {item.variant.size_slug}{item.variant.color_slug ? ` · ${item.variant.color_slug}` : ""}
                                                <span className="text-gray-400 normal-case"> · {item.variant.stock_quantity} in stock</span>
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400">{fmt(item.price)} each</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button type="button"
                                            className="w-7 h-7 flex items-center justify-center border rounded text-gray-600 hover:bg-gray-50 text-lg leading-none"
                                            onClick={() => handleQuantityChange(item.key, item.quantity - 1)}>−</button>
                                        <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                                        <button type="button"
                                            className="w-7 h-7 flex items-center justify-center border rounded text-gray-600 hover:bg-gray-50 text-lg leading-none"
                                            disabled={item.variant && item.quantity >= item.variant.stock_quantity}
                                            onClick={() => handleQuantityChange(item.key, item.quantity + 1)}>+</button>
                                        <button type="button" onClick={() => handleRemoveItem(item.key)}
                                            className="ml-1 p-1 text-red-400 hover:text-red-600">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {/* Summary */}
                            <div className="pt-2 space-y-1 text-sm">
                                <div className="flex justify-between text-gray-500">
                                    <span>Subtotal</span><span>{fmt(orderSummary.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-gray-500">
                                    <span>Delivery</span><span>{fmt(orderSummary.delivery_charge)}</span>
                                </div>
                                <div className="flex justify-between font-semibold border-t pt-2 mt-1">
                                    <span>Total</span>
                                    <span className="text-blue-600">{fmt(orderSummary.total_amount)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ── Shipping Address ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <MapPin className="h-4 w-4" /> Shipping Address
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <Label className="text-xs">Full Name *</Label>
                            <Input className="mt-1 h-9" value={shippingAddressFullName}
                                onChange={(e) => handleChange(setShippingAddressFullName, "shippingAddressFullName", e.target.value)}
                                placeholder="Full name" />
                            {error.shippingAddressFullName && <p className="text-red-500 text-xs mt-0.5">{error.shippingAddressFullName}</p>}
                        </div>
                        <div>
                            <Label className="text-xs">Address Line 1 *</Label>
                            <Input className="mt-1 h-9" value={shippingAddressAddressLine1}
                                onChange={(e) => handleChange(setShippingAddressAddressLine1, "shippingAddressAddressLine1", e.target.value)}
                                placeholder="Street address" />
                            {error.shippingAddressAddressLine1 && <p className="text-red-500 text-xs mt-0.5">{error.shippingAddressAddressLine1}</p>}
                        </div>
                        <div>
                            <Label className="text-xs">Address Line 2</Label>
                            <Input className="mt-1 h-9" value={shippingAddressAddressLine2}
                                onChange={(e) => handleChange(setShippingAddressAddressLine2, "shippingAddressAddressLine2", e.target.value)}
                                placeholder="Apt, suite (optional)" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">City *</Label>
                                <Input className="mt-1 h-9" value={shippingAddressCity}
                                    onChange={(e) => handleChange(setShippingAddressCity, "shippingAddressCity", e.target.value)}
                                    placeholder="City" />
                                {error.shippingAddressCity && <p className="text-red-500 text-xs mt-0.5">{error.shippingAddressCity}</p>}
                            </div>
                            <div>
                                <Label className="text-xs">State *</Label>
                                <Input className="mt-1 h-9" value={shippingAddressState}
                                    onChange={(e) => handleChange(setShippingAddressState, "shippingAddressState", e.target.value)}
                                    placeholder="State" />
                                {error.shippingAddressState && <p className="text-red-500 text-xs mt-0.5">{error.shippingAddressState}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Postal Code *</Label>
                                <Input className="mt-1 h-9" type="text" inputMode="numeric" maxLength={6}
                                    value={shippingAddressPostalCode}
                                    onChange={(e) => handleChange(setShippingAddressPostalCode, "shippingAddressPostalCode", e.target.value.replace(/[^0-9]/g, ""))}
                                    placeholder="123456" />
                                {error.shippingAddressPostalCode && <p className="text-red-500 text-xs mt-0.5">{error.shippingAddressPostalCode}</p>}
                            </div>
                            <div>
                                <Label className="text-xs">Country</Label>
                                <Input className="mt-1 h-9" value={shippingAddressCountry}
                                    onChange={(e) => handleChange(setShippingAddressCountry, "shippingAddressCountry", e.target.value)}
                                    placeholder="India" />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">Shipping Phone *</Label>
                            <div className="mt-1">
                                <PhoneInput country="in" enableSearch={false} disableDropdown={true}
                                    value={shippingAddressPhone}
                                    onChange={(phone) => handleChange(setShippingAddressPhone, "shippingAddressPhone", phone)}
                                    placeholder="9876543210"
                                    className="rounded-sm outline-none phone-input-container border-0"
                                />
                            </div>
                            {error.shippingAddressPhone && <p className="text-red-500 text-xs mt-0.5">{error.shippingAddressPhone}</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* ── Notes ── */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                            placeholder="Additional notes for this order..." rows={3} className="text-sm" />
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-3 pt-2 pb-6">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={loading} className="flex-1">
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading || selectedItems.length === 0} className="flex-1">
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? "Creating..." : `Create${orderSummary.total_amount > 0 ? ` · ${fmt(orderSummary.total_amount)}` : ""}`}
                    </Button>
                </div>
            </form>
        </div>
    );
}
