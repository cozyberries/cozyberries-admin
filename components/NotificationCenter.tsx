// components/NotificationCenter.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Lottie from 'lottie-react';
import animationData from '@/components/NotificationV4/notification-V4.json';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    created_at: string;
}

export default function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());
    const abortControllerRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const markingAsReadRef = useRef<Set<string>>(new Set());

    const fetchNotifications = useCallback(async () => {
        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            setLoading(true);
            setError(null);
            const res = await fetch("/api/notifications", {
                signal: abortController.signal
            });
            
            if (!res.ok) {
                throw new Error(`Failed to fetch notifications: ${res.status}`);
            }
            
            const data = await res.json();
            
            // Only update state if component is still mounted and request wasn't aborted
            if (isMountedRef.current && !abortController.signal.aborted) {
                setNotifications(data.notifications || []);
            }
        } catch (err) {
            // Ignore abort errors
            if (err instanceof Error && err.name === 'AbortError') {
                // Still need to reset loading state even if aborted
                if (isMountedRef.current) {
                    setLoading(false);
                }
                return;
            }
            
            console.error("Error fetching notifications:", err);
            
            // Only update state if component is still mounted
            if (isMountedRef.current) {
                setError("Failed to load notifications");
                setNotifications([]);
            }
        } finally {
            // Always reset loading state if component is still mounted
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        fetchNotifications();

        return () => {
            isMountedRef.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchNotifications]);

    const markAsRead = useCallback(async (id: string) => {
        // Synchronously check if already marking as read to prevent duplicate API calls
        if (markingAsReadRef.current.has(id)) {
            return; // Already processing, skip
        }
        
        // Add to ref and state synchronously before making API call
        markingAsReadRef.current.add(id);
        setMarkingAsRead((prev) => new Set(prev).add(id));
        
        try {
            const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
            if (!res.ok) {
                throw new Error(`Failed to mark notification as read: ${res.status}`);
            }
            
            // Only update state if component is still mounted
            if (isMountedRef.current) {
                setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
            }
        } catch (err) {
            console.error("Error marking notification as read:", err);
        } finally {
            // Remove from ref and state after request completes, but only if component is still mounted
            markingAsReadRef.current.delete(id);
            if (isMountedRef.current) {
                setMarkingAsRead((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            if (
                panelRef.current &&
                !panelRef.current.contains(target) &&
                buttonRef.current &&
                !buttonRef.current.contains(target)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open]);

    const panel = open ? (
        <div
            ref={panelRef}
            data-notification-panel
            className="fixed left-10 top-14 w-80 bg-white shadow-lg rounded-sm border border-gray-200 z-[9999]"
            style={{ zIndex: 9999 }}
        >
            <div className="p-3 font-semibold border-b flex items-center justify-between">
                <span>Notifications</span>
                <button
                    onClick={() => setOpen(false)}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                    aria-label="Close notifications"
                >
                    ×
                </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
                {loading ? (
                    <div className="p-3 text-gray-500 text-sm text-center">Loading...</div>
                ) : error ? (
                    <div className="p-3 text-red-500 text-sm text-center">{error}</div>
                ) : notifications.length > 0 ? (
                    notifications.map((n) => (
                        <div
                            key={n.id}
                            onClick={() => !markingAsRead.has(n.id) && markAsRead(n.id)}
                            className={`p-3 cursor-pointer transition-colors ${
                                n.is_read ? "bg-gray-50" : "bg-blue-50"
                            } hover:bg-gray-100 border-b ${
                                markingAsRead.has(n.id) ? "opacity-50 cursor-wait" : ""
                            }`}
                        >
                            <div className="font-medium">{n.title}</div>
                            <div className="text-sm text-gray-600">{n.message}</div>
                            <div className="text-xs text-gray-400 mt-1">
                                {new Date(n.created_at).toLocaleString()}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-3 text-gray-500 text-sm">No notifications</div>
                )}
            </div>
        </div>
    ) : null;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                data-notification-button
                onClick={() => setOpen(!open)}
                className="relative pt-2"
                aria-label="Toggle notifications"
            >
                <Lottie
                    animationData={animationData}
                    loop={true}
                    style={{ width: 30, height: 30 }}
                />
                {notifications.some((n) => !n.is_read) && (
                    <span className="absolute top-[6px] right-1 h-2 w-2 bg-red-500 rounded-full" />
                )}
            </button>

            {typeof window !== "undefined" && open &&
                createPortal(panel, document.body)}
        </div>
    );
}
