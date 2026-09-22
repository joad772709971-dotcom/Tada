import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  wholesalerId: string;
  wholesalerName: string;
  selectedColor?: string;
  maxStock: number;
  warrantyType?: 'none' | 'operational' | 'limited';
  warrantyDuration?: number; // in days
  compensationOption?: 'refund' | 'replace_same' | 'replace_other';
  imageUrl?: string;
  photos?: string[];
}

interface ShoppingCartContextType {
  cart: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  updateQuantity: (productId: string, selectedColor: string | undefined, quantity: number) => void;
  removeItem: (productId: string, selectedColor: string | undefined) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  getWholesalersInCart: () => { id: string; name: string }[];
  updateItemOptions: (
    productId: string,
    oldColor: string | undefined,
    updates: Partial<Pick<CartItem, 'selectedColor' | 'warrantyType' | 'warrantyDuration' | 'compensationOption' | 'price' | 'maxStock'>>
  ) => void;
}

const ShoppingCartContext = createContext<ShoppingCartContextType | undefined>(undefined);

export function ShoppingCartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('jam_supplier_market_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse saved marketplace cart:', e);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jam_supplier_market_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save marketplace cart:', e);
    }
  }, [cart]);

  const addItem = (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setCart((prevCart) => {
      const quantityToAdd = item.quantity ?? 1;
      // Index matching based on product ID and selected variant color (if any)
      const existingIndex = prevCart.findIndex(
        (i) => i.productId === item.productId && i.selectedColor === item.selectedColor
      );

      if (existingIndex !== -1) {
        const updatedCart = [...prevCart];
        const existingItem = updatedCart[existingIndex];
        const newQuantity = Math.min(existingItem.quantity + quantityToAdd, item.maxStock);
        updatedCart[existingIndex] = {
          ...existingItem,
          quantity: newQuantity,
        };
        return updatedCart;
      } else {
        return [
          ...prevCart,
          {
            ...item,
            quantity: Math.min(quantityToAdd, item.maxStock),
          },
        ];
      }
    });
  };

  const updateQuantity = (productId: string, selectedColor: string | undefined, quantity: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.productId === productId && item.selectedColor === selectedColor) {
            return { ...item, quantity: Math.max(1, Math.min(quantity, item.maxStock)) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (productId: string, selectedColor: string | undefined) => {
    setCart((prevCart) =>
      prevCart.filter((item) => !(item.productId === productId && item.selectedColor === selectedColor))
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const getWholesalersInCart = () => {
    const list: { id: string; name: string }[] = [];
    cart.forEach((item) => {
      if (!list.some((w) => w.id === item.wholesalerId)) {
        list.push({ id: item.wholesalerId, name: item.wholesalerName });
      }
    });
    return list;
  };

  const updateItemOptions = (
    productId: string,
    oldColor: string | undefined,
    updates: Partial<Pick<CartItem, 'selectedColor' | 'warrantyType' | 'warrantyDuration' | 'compensationOption' | 'price' | 'maxStock'>>
  ) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.productId === productId && item.selectedColor === oldColor) {
          return { ...item, ...updates };
        }
        return item;
      })
    );
  };

  return (
    <ShoppingCartContext.Provider
      value={{
        cart,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        getCartTotal,
        getCartCount,
        getWholesalersInCart,
        updateItemOptions,
      }}
    >
      {children}
    </ShoppingCartContext.Provider>
  );
}

export function useShoppingCart() {
  const context = useContext(ShoppingCartContext);
  if (context === undefined) {
    throw new Error('useShoppingCart must be used within a ShoppingCartProvider');
  }
  return context;
}
