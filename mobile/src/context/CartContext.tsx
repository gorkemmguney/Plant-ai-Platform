import React, { createContext, useContext, useState } from 'react';

export interface CartProduct {
  prod_id: number;
  name: string;
  price: string | number;
  stock: number;
}

interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  addToCart: (product: CartProduct, quantity?: number) => void;
  removeFromCart: (prodId: number) => void;
  changeQty: (prodId: number, delta: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue>({
  items: [],
  count: 0,
  total: 0,
  addToCart: () => {},
  removeFromCart: () => {},
  changeQty: () => {},
  clearCart: () => {},
});

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = (product: CartProduct, quantity: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.prod_id === product.prod_id);
      if (existing) {
        return prev.map((i) =>
          i.product.prod_id === product.prod_id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const removeFromCart = (prodId: number) => {
    setItems((prev) => prev.filter((i) => i.product.prod_id !== prodId));
  };

  const changeQty = (prodId: number, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.product.prod_id === prodId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const clearCart = () => setItems([]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, count, total, addToCart, removeFromCart, changeQty, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
