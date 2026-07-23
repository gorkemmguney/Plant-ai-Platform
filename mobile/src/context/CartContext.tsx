import React, { createContext, useContext, useState } from 'react';

export interface CartProduct {
  prod_id: number;
  name: string;
  price: string | number;
  stock: number;
  seller_id?: number | null;
  seller_name?: string | null;
  image_url?: string | null;
}

export interface SelectedCharacteristic {
  gnl_char_id: number;
  char_name: string;
  gnl_char_val_id: number;
  value: string;
}

interface CartItem {
  // Aynı ürünün farklı varyantları (ör. Yeşil vs Kırmızı Çiçekli) ayrı sepet
  // satırları olsun diye prod_id + seçilen değerlerin birleşiminden üretilir.
  lineKey: string;
  product: CartProduct;
  quantity: number;
  selectedCharacteristics: SelectedCharacteristic[];
}

function buildLineKey(prodId: number, chars: SelectedCharacteristic[]): string {
  const ids = chars.map((c) => c.gnl_char_val_id).sort((a, b) => a - b);
  return `${prodId}::${ids.join(',')}`;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  addToCart: (product: CartProduct, quantity?: number, selectedCharacteristics?: SelectedCharacteristic[]) => void;
  removeFromCart: (lineKey: string) => void;
  changeQty: (lineKey: string, delta: number) => void;
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

  const addToCart = (
    product: CartProduct,
    quantity: number = 1,
    selectedCharacteristics: SelectedCharacteristic[] = []
  ) => {
    const lineKey = buildLineKey(product.prod_id, selectedCharacteristics);
    setItems((prev) => {
      const existing = prev.find((i) => i.lineKey === lineKey);
      if (existing) {
        return prev.map((i) => (i.lineKey === lineKey ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { lineKey, product, quantity, selectedCharacteristics }];
    });
  };

  const removeFromCart = (lineKey: string) => {
    setItems((prev) => prev.filter((i) => i.lineKey !== lineKey));
  };

  const changeQty = (lineKey: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) => (i.lineKey === lineKey ? { ...i, quantity: i.quantity + delta } : i)).filter((i) => i.quantity > 0)
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
