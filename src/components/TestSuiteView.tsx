/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { runAutomatedTestSuite, TestSuiteReport } from '../lib/automatedTests';
import { SupportedLanguage } from '../lib/types';
import { translations } from '../lib/i18n';
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Check,
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface TestSuiteViewProps {
  lang: SupportedLanguage;
}

export const TestSuiteView: React.FC<TestSuiteViewProps> = ({ lang }) => {
  const t = translations[lang];

  const [report, setReport] = useState<TestSuiteReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Run on initial load
    handleRunTests();
  }, []);

  const handleRunTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const res = runAutomatedTestSuite();
      setReport(res);
      setIsRunning(false);
    }, 200);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Automated Test Suite (Section 24 Specification)</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {lang === 'ta' ? 'தானியங்கி வணிக விதி சோதனைகள்' : 'Automated Financial Rule Test Suite'}
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {lang === 'ta'
              ? '₹10,000 அசல், ₹1,500 முன்பிடித்தம், ₹8,500 கை ரொக்கம், 10 வார தவணை, செவ்வாய் ₹150 அபராதம் மற்றும் நினைவூட்டல் ரத்து விதி சோதனைகள்.'
              : 'Validates ₹10,000 loan terms, Sunday dues, single ₹150 Tuesday penalty rule, idempotency, partial repayments, and WhatsApp reminder suppression.'}
          </p>
        </div>

        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors disabled:opacity-50 shrink-0"
        >
          <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Running All Assertions...' : 'Re-Run All Automated Tests'}</span>
        </button>
      </div>

      {/* Results Overview */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 block">Total Assertions</span>
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {report.total}
              </span>
            </div>
            <FlaskConical className="w-8 h-8 text-slate-300" />
          </div>

          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-800 font-medium block">Passed Assertions</span>
              <span className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
                {report.passed}
              </span>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 block">Failed Assertions</span>
              <span
                className={`text-2xl font-bold font-mono tabular-nums ${
                  report.failed > 0 ? 'text-red-600' : 'text-slate-400'
                }`}
              >
                {report.failed}
              </span>
            </div>
            <XCircle
              className={`w-8 h-8 ${report.failed > 0 ? 'text-red-500' : 'text-slate-300'}`}
            />
          </div>
        </div>
      )}

      {/* Test Items Table */}
      {report && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 uppercase tracking-wider">
              Verification Test Results ({report.passed}/{report.total} Passing)
            </span>
            <span className="font-mono text-slate-400 text-[11px]">
              Executed at {new Date(report.executedAt).toLocaleTimeString('en-IN')}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {report.results.map(item => (
              <div
                key={item.id}
                className="p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                      {item.id}
                    </span>
                    <span className="font-semibold text-slate-900">{item.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                    <span className="uppercase text-[10px] text-slate-400">{item.category}</span>
                    <span>·</span>
                    <span>{item.message}</span>
                  </div>
                  {item.details && (
                    <pre className="p-2 bg-red-50 text-red-800 text-[11px] rounded mt-1 font-mono whitespace-pre-wrap">
                      {item.details}
                    </pre>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[11px] text-slate-400">
                    {item.durationMs}ms
                  </span>
                  {item.passed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      PASSED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
                      <XCircle className="w-3.5 h-3.5" />
                      FAILED
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
