/**
 * Token Context Menu Component
 * 
 * Right-click context menu for token operations.
 */

import React, { useEffect, useRef } from 'react';
import {
    Type, Scissors, Merge, Plus, Trash2, ArrowUpDown
} from 'lucide-react';

/**
 * @param {Object} props
 * @param {number} props.x
 * @param {number} props.y
 * @param {boolean} props.visible
 * @param {number} props.selectedCount
 * @param {Function} props.onAction - (action: string)
 * @param {Function} props.onClose
 */
export default function TokenContextMenu({
    x, y, visible, selectedCount, onAction, onClose
}) {
    const menuRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        if (!visible) return;

        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        // Delay to prevent immediate close from the right-click event
        setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [visible, onClose]);

    // Close on escape
    useEffect(() => {
        if (!visible) return;

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [visible, onClose]);

    if (!visible) return null;

    const menuItems = [
        { id: 'edit', label: 'Edit Text', icon: Type, shortcut: 'E' },
        { id: 'word-length', label: 'Word Length', icon: ArrowUpDown, shortcut: '↑↓', disabled: selectedCount !== 1 },
        { id: 'split', label: 'Split Token', icon: Scissors, shortcut: 'S', disabled: selectedCount !== 1 },
        { id: 'merge', label: 'Merge Tokens', icon: Merge, shortcut: 'M', disabled: selectedCount < 2 },
        { type: 'separator' },
        { id: 'insert-before', label: 'Insert Before', icon: Plus },
        { id: 'insert-after', label: 'Insert After', icon: Plus },
        { type: 'separator' },
        { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Del', danger: true },
    ];

    return (
        <div
            ref={menuRef}
            className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[160px] z-50"
            style={{ left: x, top: y }}
        >
            {menuItems.map((item, i) => {
                if (item.type === 'separator') {
                    return <div key={i} className="h-px bg-gray-700 my-1" />;
                }

                const Icon = item.icon;

                return (
                    <button
                        key={item.id}
                        onClick={() => !item.disabled && onAction(item.id)}
                        disabled={item.disabled}
                        className={`
              w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm
              ${item.disabled
                                ? 'text-gray-600 cursor-not-allowed'
                                : item.danger
                                    ? 'text-red-400 hover:bg-red-900/30'
                                    : 'text-gray-200 hover:bg-gray-700'
                            }
            `}
                    >
                        <Icon size={14} />
                        <span className="flex-1">{item.label}</span>
                        {item.shortcut && (
                            <span className="text-xs text-gray-500">{item.shortcut}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
