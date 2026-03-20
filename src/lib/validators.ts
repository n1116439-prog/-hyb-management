export function validateRequired(value: string, label: string): string {
  if (!value || !value.trim()) return `請輸入${label}`;
  return '';
}

export function validateName(name: string, label?: string): string {
  const l = label || '姓名';
  if (!name || !name.trim()) return `請輸入${l}`;
  if (name.trim().length < 2 || name.trim().length > 20) return `${l}需要 2-20 個字`;
  if (/^\d+$/.test(name.trim())) return `${l}不能是純數字`;
  return '';
}

export function validateEmail(email: string): string {
  if (!email || !email.trim()) return '請輸入 Email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email 格式不正確';
  return '';
}

export function validatePassword(password: string): string {
  if (!password) return '請輸入密碼';
  if (password.length < 6) return '密碼至少需要 6 位';
  return '';
}

export function validateConfirmPassword(password: string, confirm: string): string {
  if (!confirm) return '請再次輸入密碼';
  if (password !== confirm) return '兩次輸入的密碼不一致';
  return '';
}

export function validatePhone(phone: string, required?: boolean): string {
  if (!phone || !phone.trim()) {
    return required ? '請輸入電話號碼' : '';
  }
  const cleaned = phone.replace(/-/g, '');
  if (!/^09\d{8}$/.test(cleaned)) return '電話格式不正確（09 開頭 10 碼）';
  return '';
}

export function validateBirthDate(dateStr: string, required?: boolean): string {
  if (!dateStr || !dateStr.trim()) {
    return required ? '請選擇出生日期' : '';
  }
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) return '出生日期不能是未來日期';
  const age = today.getFullYear() - date.getFullYear();
  if (age > 120) return '出生日期不合理';
  return '';
}

const ID_LETTER_MAP: Record<string, number> = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34,
  J: 18, K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25,
  S: 26, T: 27, U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
};

export function validateIdNumber(idNumber: string): string {
  if (!idNumber || !idNumber.trim()) return '';
  const id = idNumber.trim().toUpperCase();
  if (!/^[A-Z][12]\d{8}$/.test(id)) return '身分證格式不正確（1 英文 + 9 數字）';

  const letterNum = ID_LETTER_MAP[id[0]];
  if (!letterNum) return '身分證格式不正確（1 英文 + 9 數字）';

  const n1 = Math.floor(letterNum / 10);
  const n2 = letterNum % 10;
  const digits = [n1, n2, ...id.slice(1).split('').map(Number)];
  const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * weights[i];
  }
  if (sum % 10 !== 0) return '身分證檢查碼不正確';
  return '';
}

export function validateBankAccount(account: string): string {
  if (!account || !account.trim()) return '';
  const cleaned = account.replace(/-/g, '');
  if (!/^\d{10,16}$/.test(cleaned)) return '帳號格式不正確（10-16 碼數字）';
  return '';
}

export function validateAddress(address: string): string {
  if (!address || !address.trim()) return '';
  if (address.trim().length < 5 || address.trim().length > 100) return '地址長度需要 5-100 字';
  return '';
}
