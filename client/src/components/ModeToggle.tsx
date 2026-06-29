import React from "react";
import { AnalysisMode } from "@/lib/types";

interface ModeToggleProps {
  mode: AnalysisMode;
  setMode: (mode: AnalysisMode) => void;
}

const ModeToggle: React.FC<ModeToggleProps> = ({ mode, setMode }) => {
  return (
    <div className="bg-gray-100 p-1 rounded-lg inline-flex" role="group">
      <button
        className={`px-4 py-2 rounded-md font-medium ${
          mode === "single"
            ? "bg-blue-600 text-white"
            : "text-gray-700 hover:bg-gray-200"
        }`}
        onClick={() => setMode("single")}
      >
        Single Document
      </button>
      <button
        className={`px-4 py-2 rounded-md font-medium ${
          mode === "compare"
            ? "bg-blue-600 text-white"
            : "text-gray-700 hover:bg-gray-200"
        }`}
        onClick={() => setMode("compare")}
      >
        Compare Two Documents
      </button>
    </div>
  );
};

export default ModeToggle;
