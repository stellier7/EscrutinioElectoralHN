"use client";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export const notifyError = (msg: string) => toast.error(msg, { position: 'bottom-center' });
export const notifySuccess = (msg: string) => toast.success(msg, { position: 'bottom-center' });

export function GlobalToast() {
  return <ToastContainer newestOnTop closeOnClick pauseOnHover theme="light" />;
}

export default GlobalToast;

