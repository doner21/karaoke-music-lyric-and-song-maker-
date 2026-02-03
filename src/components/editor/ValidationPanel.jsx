/**
 * Validation Panel Component
 * 
 * Displays a list of validation issues with navigation.
 */

import React from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, X, AlertCircle, Clock, Layers } from 'lucide-react';

/**
 * @param {Object} props
 * @param {ValidationIssue[]} props.issues
 * @param {boolean} props.isOpen
 * @param {Function} props.onToggle
 * @param {Function} props.onGoToToken - (tokenId: string)
 */
export default function ValidationPanel({ issues, isOpen, onToggle, onGoToToken }) {
    if (!isOpen) return null;

    const getIssueIcon = (type) => {
        switch (type) {
            case 'overlap':
                return <Layers size={12} className="text-red-400" />;
            case 'duration':
                return <Clock size={12} className="text-amber-400" />;
            case 'bounds':
                return <AlertCircle size={12} className="text-orange-400" />;
            case 'negative':
                return <AlertTriangle size={12} className="text-red-500" />;
            default:
                return <AlertCircle size={12} className="text-gray-400" />;
        }
    };

    const getIssueColor = (type) => {
        switch (type) {
            case 'overlap':
                return 'border-red-500/50 bg-red-950/30';
            case 'duration':
                return 'border-amber-500/50 bg-amber-950/30';
            case 'bounds':
                return 'border-orange-500/50 bg-orange-950/30';
            case 'negative':
                return 'border-red-700/50 bg-red-950/50';
            default:
                return 'border-gray-500/50 bg-gray-900/30';
        }
    };

    return (
        <div className="absolute bottom-12 right-4 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-30">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-400" />
                    <span className="text-sm font-semibold text-gray-200">
                        Validation Issues ({issues.length})
                    </span>
                </div>
                <button
                    onClick={onToggle}
                    className="p-1 hover:bg-gray-800 rounded"
                >
                    <X size={14} className="text-gray-400" />
                </button>
            </div>

            {/* Issue List */}
            <div className="max-h-64 overflow-y-auto">
                {issues.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                        No issues found
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800">
                        {issues.map((issue, i) => (
                            <div
                                key={`${issue.tokenId}-${issue.type}-${i}`}
                                className={`flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-gray-800/50 ${getIssueColor(issue.type)}`}
                                onClick={() => onGoToToken(issue.tokenId)}
                            >
                                <div className="mt-0.5">
                                    {getIssueIcon(issue.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-gray-200 truncate">
                                        {issue.message}
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                        Token: {issue.tokenId.slice(0, 8)}...
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
