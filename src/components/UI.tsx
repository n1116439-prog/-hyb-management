import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon: Icon, 
  loading, 
  className = '', 
  type = 'button',
  ...props 
}) => {
  const baseStyles = "flex items-center justify-center gap-2 h-[52px] px-6 rounded-button font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none w-full";
  const variants = {
    primary: "bg-primary text-white shadow-active hover:bg-primary/90",
    outline: "border-2 border-primary text-primary bg-transparent hover:bg-primary/5",
    ghost: "text-neutral-600 bg-transparent hover:bg-neutral-100"
  };

  return (
    <button 
      type={type}
      {...props}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {Icon && <Icon size={20} />}
          {children}
        </>
      )}
    </button>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; variant?: 'accent' | 'warning' | 'danger' | 'neutral' | 'secondary'; style?: React.CSSProperties; className?: string }> = ({ 
  children, 
  variant = 'neutral',
  style,
  className = ''
}) => {
  const variants = {
    accent: "bg-accent/10 text-accent",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
    neutral: "bg-neutral-100 text-neutral-600",
    secondary: "bg-secondary/10 text-secondary"
  };

  return (
    <span 
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${variants[variant]} ${className}`}
      style={style}
    >
      {children}
    </span>
  );
};

export const ProgressBar: React.FC<{ current: number; max: number; color?: string }> = ({ current, max, color = 'bg-primary' }) => {
  const percentage = Math.min((current / max) * 100, 100);
  return (
    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`h-full ${color}`}
      />
    </div>
  );
};

export const FormField: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-neutral-600 ml-1">{label}</label>
      {children}
      {error && <p className="text-xs text-danger ml-1">{error}</p>}
    </div>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }> = ({ error, ...props }) => {
  return (
    <input 
      {...props}
      className={`w-full h-[48px] px-4 rounded-input border ${error ? 'border-danger bg-danger/5' : 'border-neutral-300'} focus:border-primary focus:ring-1 focus:ring-primary focus:bg-primary-light outline-none transition-all ${props.className || ''}`}
    />
  );
};

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }> = ({ children, error, ...props }) => {
  return (
    <select 
      {...props}
      className={`w-full h-[48px] px-4 rounded-input border ${error ? 'border-danger bg-danger/5' : 'border-neutral-300'} focus:border-primary focus:ring-1 focus:ring-primary focus:bg-primary-light outline-none transition-all appearance-none bg-white ${props.className || ''}`}
    >
      {children}
    </select>
  );
};
