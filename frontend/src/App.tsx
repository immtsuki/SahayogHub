import React, { useState } from "react";
import SearchPage from "./features/search/SearchPage";
import AIAnalysisPage from "./features/ai-analysis/AIAnalysisPage";
import type { Page } from "./types/navigation";

const App: React.FC = () => {
  const [page, setPage] = useState<Page>("home");

  switch (page) {
    case "search":
      return <SearchPage onNavigate={setPage} />;
    case "ai-analysis":
      return <AIAnalysisPage onBack={() => setPage("home")} onNavigate={setPage} />;
    default:
      return "error";
  }
};

export default App;


