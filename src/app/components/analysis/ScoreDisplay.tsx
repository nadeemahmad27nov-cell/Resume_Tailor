"use client";

import { motion, Variants } from "framer-motion";

interface ScoreDisplayProps {
  score: number;
}

const cardHoverVariants: Variants = {
  initial: { 
    scale: 1, 
    y: 0 
  },
  hover: {
    scale: 1.03,
    y: -8,
    transition: { type: "spring" as const, stiffness: 300, damping: 20 }
  }
};

const glowVariants: Variants = {
  initial: { opacity: 0 },
  hover: { 
    opacity: 0.8,
    transition: { duration: 0.4, ease: "easeInOut" }
  }
};

export default function ScoreDisplay({ score }: ScoreDisplayProps) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreTheme = () => {
    if (score >= 85) {
      return {
        color: "#22c55e",
        gradient: "from-green-400 to-blue-400"
      };
    }
    if (score >= 60) {
      return {
        color: "#f59e0b",
        gradient: "from-amber-400 to-orange-400"
      };
    }
    return {
      color: "#ef4444",
      gradient: "from-red-400 to-purple-400"
    };
  };

  const { color: scoreColor, gradient: scoreGradient } = getScoreTheme();

  return (
    <motion.div
        initial="initial"
        whileHover="hover"
        variants={cardHoverVariants}
        className="relative h-full"
    >
        <motion.div 
            variants={glowVariants}
            className={`absolute -inset-0.5 bg-gradient-to-r ${scoreGradient} rounded-2xl blur-lg opacity-0 -z-10`}
        />

        <div className="flex flex-col items-center justify-center p-6 bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg h-full">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 text-center">Compatibility Score</h2>
            <div className="relative h-40 w-40">
                <svg className="h-full w-full" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke="#e5e7eb"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke={scoreColor}
                      strokeWidth="10"
                      fill="transparent"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset }}
                      transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                      transform="rotate(-90 50 50)"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      className="text-4xl font-bold"
                      style={{ color: scoreColor }}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 1 }}
                    >
                      {score}
                    </motion.span>
                    <span className="text-sm font-medium text-slate-500">out of 100</span>
                </div>
            </div>
            <p className="text-center text-slate-600 mt-4 text-sm">
                This score reflects the match between your resume and the job description.
            </p>
        </div>
    </motion.div>
  );
}
