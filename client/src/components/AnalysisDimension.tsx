import React, { useState } from "react";
import { AnalysisDimension as AnalysisDimensionType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { getRatingColorClass } from "@/lib/analysis";
import { ChevronDown, ChevronUp } from "lucide-react";

interface AnalysisDimensionProps {
  dimension: AnalysisDimensionType;
}

const AnalysisDimension: React.FC<AnalysisDimensionProps> = ({ dimension }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Determine the badge variant based on the calibrated rating system
  const getBadgeVariant = (rating: string) => {
    switch (rating) {
      case "Exceptional":
        return "exceptional"; // Blueprint-grade (95-98)
      case "Very Strong":
        return "veryStrong"; // Blueprint-grade (90-94)
      case "Strong":
        return "strong"; // Advanced critique (85-89)
      case "Moderate":
        return "moderate"; // Advanced critique (80-84)
      case "Basic":
        return "basic"; // Surface polish (70-79)
      case "Weak":
        return "weak"; // Surface polish (60-69)
      case "Very Weak":
        return "veryWeak"; // Fluent but shallow (40-59)
      case "Critically Deficient":
        return "criticallyDeficient"; // Random noise (0-39)
      default:
        return "default";
    }
  };

  return (
    <div className="analysis-dimension border-b border-gray-200 last:border-b-0">
      <button
        className="dimension-header w-full flex justify-between items-center p-4 focus:outline-none"
        onClick={toggleExpand}
      >
        <div className="flex items-center">
          <span className="font-medium text-gray-800">{dimension.name}</span>
          <Badge
            variant={getBadgeVariant(dimension.rating) as any}
            className="ml-2 px-2 py-1 text-xs rounded-full"
          >
            {dimension.rating}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>
      
      <div className={`p-4 bg-gray-50 ${isExpanded ? "" : "hidden"}`}>
        <p className="text-gray-700 mb-3">{dimension.description}</p>
        <div className="bg-gray-100 p-3 rounded-md border-l-4 border-blue-500">
          <p className="text-gray-700 text-sm italic">{dimension.quote}</p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDimension;
