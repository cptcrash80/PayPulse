import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaycheckConfig, Category, RecurringBill, Expense, Debt, DashboardData } from '../models/models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Dashboard
  getDashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.base}/dashboard`);
  }
  getPeriodDetail(payDate: string): Observable<any> {
    return this.http.get(`${this.base}/dashboard/period/${payDate}`);
  }

  // Paycheck
  getPaycheck(): Observable<PaycheckConfig | null> {
    return this.http.get<PaycheckConfig | null>(`${this.base}/paycheck`);
  }
  savePaycheck(data: { amount: number; start_date: string; transfer_amount: number; minimum_spending: number }): Observable<PaycheckConfig> {
    return this.http.post<PaycheckConfig>(`${this.base}/paycheck`, data);
  }
  updateTransfer(transfer_amount: number): Observable<PaycheckConfig> {
    return this.http.patch<PaycheckConfig>(`${this.base}/paycheck/transfer`, { transfer_amount });
  }

  // Categories
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }
  createCategory(data: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${this.base}/categories`, data);
  }
  updateCategory(id: string, data: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.base}/categories/${id}`, data);
  }
  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.base}/categories/${id}`);
  }

  // Bills
  getBills(): Observable<RecurringBill[]> {
    return this.http.get<RecurringBill[]>(`${this.base}/bills`);
  }
  createBill(data: Partial<RecurringBill>): Observable<RecurringBill> {
    return this.http.post<RecurringBill>(`${this.base}/bills`, data);
  }
  updateBill(id: string, data: Partial<RecurringBill>): Observable<RecurringBill> {
    return this.http.put<RecurringBill>(`${this.base}/bills/${id}`, data);
  }
  deleteBill(id: string): Observable<any> {
    return this.http.delete(`${this.base}/bills/${id}`);
  }

  // Expenses
  getExpenses(params?: { start?: string; end?: string; category_id?: string }): Observable<Expense[]> {
    const queryParams: any = {};
    if (params?.start) queryParams.start = params.start;
    if (params?.end) queryParams.end = params.end;
    if (params?.category_id) queryParams.category_id = params.category_id;
    return this.http.get<Expense[]>(`${this.base}/expenses`, { params: queryParams });
  }
  createExpense(data: Partial<Expense>): Observable<Expense> {
    return this.http.post<Expense>(`${this.base}/expenses`, data);
  }
  updateExpense(id: string, data: Partial<Expense>): Observable<Expense> {
    return this.http.put<Expense>(`${this.base}/expenses/${id}`, data);
  }
  deleteExpense(id: string): Observable<any> {
    return this.http.delete(`${this.base}/expenses/${id}`);
  }

  // Debts
  getDebts(): Observable<Debt[]> {
    return this.http.get<Debt[]>(`${this.base}/debts`);
  }
  createDebt(data: Partial<Debt>): Observable<Debt> {
    return this.http.post<Debt>(`${this.base}/debts`, data);
  }
  updateDebt(id: string, data: Partial<Debt>): Observable<Debt> {
    return this.http.put<Debt>(`${this.base}/debts/${id}`, data);
  }
  deleteDebt(id: string): Observable<any> {
    return this.http.delete(`${this.base}/debts/${id}`);
  }
  addDebtPayment(debtId: string, data: { amount: number; date: string; notes?: string }): Observable<Debt> {
    return this.http.post<Debt>(`${this.base}/debts/${debtId}/payments`, data);
  }

  // Year Review
  getYearReview(year: number): Observable<any> {
    return this.http.get(`${this.base}/review?year=${year}`);
  }

  // Subscriptions
  getSubscriptions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/subscriptions`);
  }
  createSubscription(data: any): Observable<any> {
    return this.http.post(`${this.base}/subscriptions`, data);
  }
  updateSubscription(id: string, data: any): Observable<any> {
    return this.http.put(`${this.base}/subscriptions/${id}`, data);
  }
  deleteSubscription(id: string): Observable<any> {
    return this.http.delete(`${this.base}/subscriptions/${id}`);
  }

  // Period paid tracking
  getPaidItems(payDate: string): Observable<Record<string, boolean>> {
    return this.http.get<Record<string, boolean>>(`${this.base}/paid/${payDate}`);
  }
  togglePaidItem(payDate: string, itemId: string, itemType: string): Observable<Record<string, boolean>> {
    return this.http.post<Record<string, boolean>>(`${this.base}/paid/${payDate}`, { item_id: itemId, item_type: itemType });
  }

  // Period amount overrides (variable bills)
  getAmountOverrides(payDate: string): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.base}/paid/${payDate}/overrides`);
  }
  setAmountOverride(payDate: string, itemId: string, itemType: string, amount: number): Observable<Record<string, number>> {
    return this.http.post<Record<string, number>>(`${this.base}/paid/${payDate}/overrides`, { item_id: itemId, item_type: itemType, amount });
  }

  // Snowball overrides (skip/adjust per period)
  getSnowballOverride(payDate: string): Observable<any> {
    return this.http.get(`${this.base}/paid/${payDate}/snowball`);
  }
  setSnowballOverride(payDate: string, maxExtra: number | null, notes?: string): Observable<any> {
    return this.http.post(`${this.base}/paid/${payDate}/snowball`, { max_extra: maxExtra, notes });
  }

  // Simulator
  runSimulation(params: any): Observable<any> {
    return this.http.post(`${this.base}/simulator`, params);
  }

  // Progress / Net Worth
  getProgress(): Observable<any> {
    return this.http.get(`${this.base}/progress`);
  }
}
