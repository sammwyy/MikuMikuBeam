import { X, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface MikuToastProps {
    message: string;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

export function MikuToast({ message, isVisible, onClose, duration = 3000 }: MikuToastProps) {
    const [isExiting, setIsExiting] = useState(false);
    useEffect(() => {
        if (isVisible) {
            setIsExiting(false);
            const timer = setTimeout(() => {
                handleClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(onClose, 300); 
    };

    if (!isVisible && !isExiting) return null;

    return (
        <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-4 p-4 pr-10 bg-white/95 backdrop-blur-sm border-2 border-pink-200 rounded-2xl shadow-xl shadow-pink-500/20 max-w-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    ${!isExiting && isVisible
                    ? "translate-y-0 opacity-100 scale-100"
                    : "-translate-y-4 opacity-0 scale-95"
                }`}>
            <div className="relative shrink-0">
                <img
                    src="https://media.tenor.com/YW_zz6LXY7oAAAAM/miku.gif"
                    alt="Miku Alert"
                    className="w-12 h-12 rounded-full object-cover border-2 border-pink-300 shadow-sm"
                />
                <div className="absolute -bottom-1 -right-1 bg-pink-500 rounded-full p-1 text-white animate-bounce">
                    <Sparkles className="w-3 h-3" />
                </div>
            </div>
            <div className="flex flex-col">
                <span className="text-xs font-bold text-pink-500 uppercase tracking-wider">
                    {message}
                </span>
                <span className="text-gray-700 font-medium text-sm leading-tight">
                </span>
            </div>
            <button
                onClick={handleClose}
                className="absolute top-2 right-2 text-pink-300 hover:text-pink-500 transition-colors p-1 rounded-full hover:bg-pink-50"
            >
                <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-pink-400 to-blue-400 animate-[progress_3s_linear_forwards]"
                    key={isVisible ? "visible" : "hidden"}
                />
            </div>
        </div>
    );
}