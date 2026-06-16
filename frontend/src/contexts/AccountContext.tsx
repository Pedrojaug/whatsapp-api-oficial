import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth, API_BASE_URL } from "./AuthContext";

export interface Account {
  id: string;
  name: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
}

interface AccountContextType {
  accounts: Account[];
  selectedAccount: Account | null;
  isLoadingAccounts: boolean;
  fetchAccounts: () => Promise<void>;
  selectAccount: (account: Account | null) => void;
  deleteAccount: (id: string) => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, logout } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  const fetchAccounts = async () => {
    if (!token) {
      setAccounts([]);
      setSelectedAccount(null);
      return;
    }
    setIsLoadingAccounts(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setAccounts(res.data);
      if (res.data.length > 0) {
        // Se a conta selecionada ainda existe, mantém ela, senão seleciona a primeira
        const currentSelectedId = selectedAccount?.id;
        const stillExists = res.data.find((a: any) => a.id === currentSelectedId);
        if (!stillExists) {
          setSelectedAccount(res.data[0]);
        } else {
          // Atualiza dados da conta selecionada
          setSelectedAccount(stillExists);
        }
      } else {
        setSelectedAccount(null);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      } else {
        console.error("Erro ao buscar contas Meta:", err);
      }
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [token]);

  const selectAccount = (account: Account | null) => {
    setSelectedAccount(account);
  };

  const deleteAccount = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja remover esta conta e todo o histórico associado?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/accounts/${id}`);
      if (selectedAccount?.id === id) {
        setSelectedAccount(null);
      }
      await fetchAccounts();
    } catch (err: any) {
      throw new Error(err.response?.data?.error || "Erro ao deletar conta.");
    }
  };

  return (
    <AccountContext.Provider value={{ accounts, selectedAccount, isLoadingAccounts, fetchAccounts, selectAccount, deleteAccount }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
};
