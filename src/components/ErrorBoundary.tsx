import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิดในระบบ',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in RemissionCare:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-slate-900">
                ไม่สามารถโหลดข้อมูลระบบได้ชั่วคราว
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                ระบบตรวจพบข้อผิดพลาดในการเชื่อมต่อหรือสิทธิ์การเข้าถึงข้อมูล กรุณารีเฟรชหน้าจอเพื่อเชื่อมต่อใหม่
              </p>
            </div>
            <pre className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 overflow-x-auto max-h-32">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>โหลดระบบใหม่อีกครั้ง</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
