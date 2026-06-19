import React from "react";
import Nav from "../../shared/Nav";
import StepIndicator from "./components/StepIndicator";
import AIDetectedResults from "./components/AIDetectedResults";
import EditDetailsForm from "./components/EditDetailsForm";
import type { Page } from "../../types/navigation";

interface AIAnalysisPageProps {
  onBack: () => void;
  onNavigate?: (page: Page) => void;
}

const CURRENT_STEP = 3;
const TOTAL_STEPS  = 5;
const ITEM_IMAGE   = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700&auto=format&fit=crop";

const AIAnalysisPage: React.FC<AIAnalysisPageProps> = ({ onBack, onNavigate }) => (
  <div className="min-h-screen bg-gray-50">
    <Nav active="ai-analysis" onNavigate={onNavigate ?? (() => {})} />

    {/* ── DESKTOP (lg+) ── */}
    <div className="hidden lg:flex lg:flex-col">
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <StepIndicator current={CURRENT_STEP} total={TOTAL_STEPS} variant="nodes" />
          </div>
          <span className="text-sm text-gray-400 font-medium flex-shrink-0">
            {CURRENT_STEP} of {TOTAL_STEPS}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex gap-6">
          <div className="relative rounded-xl overflow-hidden flex-shrink-0 w-72">
            <img src={ITEM_IMAGE} alt="Scanned item" className="w-full h-64 object-cover" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/85 backdrop-blur-sm text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Scanning...
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <AIDetectedResults inline />
          </div>
        </div>

        <EditDetailsForm />

        <div className="flex justify-end">
          <button className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl flex items-center gap-2 transition-colors cursor-pointer">
            Continue <span>→</span>
          </button>
        </div>
      </main>
    </div>

    {/* ── MOBILE (<lg) ── */}
    <div className="flex lg:hidden items-start justify-center py-6 px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col">
        <div className="px-4 pt-5 pb-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              aria-label="Go back"
              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            >
              ←
            </button>
            <h1 className="font-bold text-gray-900 text-base">Item Analysis</h1>
            <span className="text-sm text-gray-400 font-medium">{CURRENT_STEP} of {TOTAL_STEPS}</span>
          </div>
          <StepIndicator current={CURRENT_STEP} total={TOTAL_STEPS} variant="bars" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-5">
          <div className="relative rounded-2xl overflow-hidden">
            <img src={ITEM_IMAGE} alt="Scanned item" className="w-full h-48 object-cover" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-gray-800/80 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              🎒 Scanning...
            </div>
          </div>
          <AIDetectedResults />
          <EditDetailsForm />
        </div>

        <div className="px-4 py-4 border-t border-gray-100 bg-white">
          <button className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer">
            Continue <span>→</span>
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default AIAnalysisPage;
