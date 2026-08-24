

interface UpgradeProps {
    onClose?: () => void;
}

const Upgrade = ({ onClose }: UpgradeProps) => {
    const handleUpgradeClick = () => {
        window.electron.shell.openExternal("https://clever.qluely.in/dashboard/billing");
        if (onClose) onClose();
    };

    return (
        <div className="w-full h-full inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-500 animate-in fade-in rounded-2xl">
            <div className="relative p-8 rounded-3xl bg-zinc-900/80 border border-white/10 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] flex flex-col items-center gap-6 max-w-sm w-full mx-4 text-center transform transition-all duration-500 animate-in zoom-in-95 slide-in-from-bottom-10">
                <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Upgrade Plan</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed px-2">
                        You've hit your usage limit.
                    </p>
                </div>

                <button
                    onClick={handleUpgradeClick}
                    className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all active:scale-[0.98] shadow-[0_0_20px_-5px_rgba(37,99,235,0.4)] group overflow-hidden relative"
                >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        Unlock Full Potential
                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </button>
            </div>
        </div>
    );
};

export default Upgrade;
