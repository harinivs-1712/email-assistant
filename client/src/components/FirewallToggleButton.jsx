import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Shield, Loader2 } from 'lucide-react';
import agentService from '../services/agentService';

/**
 * FirewallToggleButton
 * 
 * Represents the inclusion of the security firewall or its absence.
 * Clicking toggles the state between:
 *   - INCLUDED (Active): External or built-in firewall validates all tool calls
 *   - ABSENT (Disabled): Unrestricted baseline mode for direct tool execution
 */
const FirewallToggleButton = ({ onToggle, compact = false, className = '' }) => {
  const [firewall, setFirewall] = useState({
    enabled: false,
    status: 'ABSENT',
    package_name: 'None',
  });
  const [loading, setLoading] = useState(false);
  const [toggleError, setToggleError] = useState('');

  // Load initial status
  useEffect(() => {
    let mounted = true;
    agentService
      .getFirewallStatus()
      .then((data) => {
        if (mounted && data?.success) {
          setFirewall(data);
        }
      })
      .catch(() => {});

    // Sync periodically
    const interval = setInterval(() => {
      agentService
        .getFirewallStatus()
        .then((data) => {
          if (mounted && data?.success) {
            setFirewall(data);
          }
        })
        .catch(() => {});
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    setToggleError('');

    try {
      const updated = await agentService.toggleFirewall();
      if (updated?.success) {
        setFirewall(updated);
        if (onToggle) onToggle(updated);
      }
    } catch (err) {
      console.error('Failed to toggle firewall state:', err);
      setToggleError(
        err.code === 'ECONNABORTED'
          ? 'The firewall service did not respond. Check that the Python agent is running.'
          : 'Could not change firewall state. Check that the Python agent is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isIncluded = firewall.enabled;

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        title={toggleError || (
          isIncluded
            ? `Firewall is INCLUDED (${firewall.package_name || 'Active'}). Click to disable.`
            : 'Firewall is ABSENT (Baseline mode). Click to include firewall.'
        )}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all shadow-2xs border cursor-pointer select-none ${
          isIncluded
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
            : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
        } ${className}`}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
        ) : isIncluded ? (
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
        ) : (
          <ShieldAlert className="w-3 h-3 text-slate-400" />
        )}
        <span className="text-[11px] font-semibold">
          {toggleError ? 'Firewall: Unavailable' : (isIncluded ? 'Firewall: Included' : 'Firewall: Absent')}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={toggleError || (
        isIncluded
          ? `Security Firewall is INCLUDED & ACTIVE (${firewall.package_name || 'Active'}). Tool calls are inspected. Click to turn OFF.`
          : 'Security Firewall is ABSENT. Direct tool execution in baseline mode. Click to turn ON.'
      )}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all shadow-xs border cursor-pointer select-none group ${
        isIncluded
          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-400'
          : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
      } ${className}`}
    >
      {/* Icon */}
      <div className="flex items-center justify-center">
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
        ) : isIncluded ? (
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
        )}
      </div>

      {/* Status indicator pulse / dot */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {isIncluded && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isIncluded ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          ></span>
        </span>

        {/* Text */}
        <span className="font-semibold text-xs tracking-tight">
          {toggleError ? 'Firewall: Unavailable' : (isIncluded ? 'Firewall: Included' : 'Firewall: Absent')}
        </span>
      </div>

      {/* Pill Badge */}
      <span
        className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
          toggleError
            ? 'bg-rose-100 text-rose-700'
            : isIncluded
            ? 'bg-emerald-200/70 text-emerald-800'
            : 'bg-slate-200 text-slate-600'
        }`}
      >
        {toggleError ? 'Error' : (isIncluded ? 'Active' : 'Off')}
      </span>
    </button>
  );
};

export default FirewallToggleButton;
