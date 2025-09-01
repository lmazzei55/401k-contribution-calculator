// Tax brackets for 2024 (Federal and California)
const TAX_BRACKETS = {
    federal: {
        single: [
            { min: 0, max: 11000, rate: 0.10 },
            { min: 11000, max: 44725, rate: 0.12 },
            { min: 44725, max: 95375, rate: 0.22 },
            { min: 95375, max: 182050, rate: 0.24 },
            { min: 182050, max: 231250, rate: 0.32 },
            { min: 231250, max: 578125, rate: 0.35 },
            { min: 578125, max: Infinity, rate: 0.37 }
        ]
    },
    california: {
        single: [
            { min: 0, max: 10099, rate: 0.01 },
            { min: 10099, max: 23942, rate: 0.02 },
            { min: 23942, max: 37788, rate: 0.04 },
            { min: 37788, max: 52455, rate: 0.06 },
            { min: 52455, max: 66295, rate: 0.08 },
            { min: 66295, max: 338639, rate: 0.093 },
            { min: 338639, max: 406364, rate: 0.103 },
            { min: 406364, max: 677275, rate: 0.113 },
            { min: 677275, max: Infinity, rate: 0.123 }
        ]
    }
};

// FICA tax rates
const FICA_RATE = 0.0765; // 6.2% Social Security + 1.45% Medicare
const SOCIAL_SECURITY_WAGE_BASE = 160200; // 2024 limit

// 401K limits for 2024
const EMPLOYEE_401K_LIMIT = 23000; // Maximum employee contribution
const TOTAL_401K_LIMIT = 69000; // Maximum total contribution (employee + employer)

// Salary frequency multipliers
const SALARY_FREQUENCY = {
    weekly: 52,
    biweekly: 26,
    semimonthly: 24,
    monthly: 12,
    annually: 1
};

class TaxCalculator {
    static calculateTax(income, brackets) {
        let tax = 0;
        for (const bracket of brackets) {
            if (income > bracket.min) {
                const taxableInBracket = Math.min(income, bracket.max) - bracket.min;
                tax += taxableInBracket * bracket.rate;
            }
        }
        return tax;
    }

    static calculateFederalTax(income) {
        return this.calculateTax(income, TAX_BRACKETS.federal.single);
    }

    static calculateStateTax(income) {
        return this.calculateTax(income, TAX_BRACKETS.california.single);
    }

    static calculateFICATax(income) {
        const socialSecurityTax = Math.min(income, SOCIAL_SECURITY_WAGE_BASE) * 0.062;
        const medicareTax = income * 0.0145;
        return socialSecurityTax + medicareTax;
    }

    static calculateTotalTaxes(income) {
        const federal = this.calculateFederalTax(income);
        const state = this.calculateStateTax(income);
        const fica = this.calculateFICATax(income);
        return { federal, state, fica, total: federal + state + fica };
    }
}

class FinancialCalculator {
    static calculate401KScenario(grossSalary, contributionPercent, employerMatch, investmentReturn, years) {
        // Calculate contribution amount, respecting 401K limits
        const maxContribution = Math.min(grossSalary * (contributionPercent / 100), EMPLOYEE_401K_LIMIT);
        const employerContribution = Math.min(grossSalary * (employerMatch / 100), EMPLOYEE_401K_LIMIT * 0.5); // Typical employer match limit
        const total401KContribution = maxContribution + employerContribution;
        
        // Taxable income after 401K contribution
        const taxableIncome = grossSalary - maxContribution;
        const taxes = TaxCalculator.calculateTotalTaxes(taxableIncome);
        const takeHomePay = taxableIncome - taxes.total;
        
        // Future value of 401K (tax-deferred)
        const futureValue401K = this.calculateFutureValue(total401KContribution, investmentReturn, years);
        
        return {
            contribution: maxContribution,
            employerContribution,
            total401KContribution,
            taxableIncome,
            taxes,
            takeHomePay,
            futureValue401K
        };
    }

    static calculateNo401KScenario(grossSalary, contributionPercent, investmentReturn, years) {
        const taxes = TaxCalculator.calculateTotalTaxes(grossSalary);
        const takeHomePay = grossSalary - taxes.total;
        
        // Amount that would have been contributed to 401K
        const potentialContribution = Math.min(grossSalary * (contributionPercent / 100), EMPLOYEE_401K_LIMIT);
        const afterTaxContribution = potentialContribution * (1 - (taxes.federal + taxes.state) / grossSalary);
        
        // Future value of brokerage investment (after-tax)
        const futureValueBrokerage = this.calculateFutureValue(afterTaxContribution, investmentReturn, years);
        
        return {
            taxes,
            takeHomePay,
            potentialContribution,
            afterTaxContribution,
            futureValueBrokerage
        };
    }

    static calculateFutureValue(annualContribution, annualReturn, years) {
        const monthlyContribution = annualContribution / 12;
        const monthlyReturn = annualReturn / 100 / 12;
        const totalMonths = years * 12;
        
        if (monthlyReturn === 0) {
            return monthlyContribution * totalMonths;
        }
        
        return monthlyContribution * ((Math.pow(1 + monthlyReturn, totalMonths) - 1) / monthlyReturn);
    }

    static formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    static formatPercent(percent) {
        return `${percent.toFixed(1)}%`;
    }

    static calculateWithdrawalTaxes(futureValue401K, retirementIncome, withdrawalStrategy, investmentReturn = 7) {
        const results = {};
        
        // Lump sum withdrawal
        const lumpSumIncome = futureValue401K + retirementIncome;
        const lumpSumTaxes = TaxCalculator.calculateTotalTaxes(lumpSumIncome);
        results.lumpSum = {
            total: futureValue401K,
            taxes: lumpSumTaxes.total,
            net: futureValue401K - lumpSumTaxes.total,
            taxRate: (lumpSumTaxes.total / futureValue401K) * 100
        };
        
        // Annual withdrawals (assuming 20-year retirement) with continued earnings
        const retirementYears = 20;
        const annualReturn = investmentReturn / 100;
        
        // Calculate annual withdrawal that depletes account over 20 years with continued growth
        const annualWithdrawal = this.calculateAnnualWithdrawal(futureValue401K, annualReturn, retirementYears);
        const annualIncome = annualWithdrawal + retirementIncome;
        const annualTaxes = TaxCalculator.calculateTotalTaxes(annualIncome);
        results.annual = {
            withdrawal: annualWithdrawal,
            taxes: annualTaxes.total,
            net: annualWithdrawal - annualTaxes.total,
            taxRate: (annualTaxes.total / annualWithdrawal) * 100
        };
        
        // Monthly withdrawals
        const monthlyWithdrawal = annualWithdrawal / 12;
        const monthlyIncome = monthlyWithdrawal * 12 + retirementIncome;
        const monthlyTaxes = TaxCalculator.calculateTotalTaxes(monthlyIncome);
        results.monthly = {
            withdrawal: monthlyWithdrawal,
            taxes: monthlyTaxes.total / 12,
            net: monthlyWithdrawal - (monthlyTaxes.total / 12),
            taxRate: (monthlyTaxes.total / monthlyIncome) * 100
        };
        
        return results;
    }

    static calculateAnnualWithdrawal(principal, annualReturn, years) {
        // Calculate the annual withdrawal amount that will deplete the account over the given years
        // while accounting for continued growth on the remaining balance
        if (annualReturn === 0) {
            return principal / years;
        }
        
        // Using the annuity formula: PMT = PV * [r(1+r)^n] / [(1+r)^n - 1]
        const numerator = annualReturn * Math.pow(1 + annualReturn, years);
        const denominator = Math.pow(1 + annualReturn, years) - 1;
        return principal * (numerator / denominator);
    }

    static getPeriodTakeHome(annualTakeHome, frequency) {
        const periodsPerYear = SALARY_FREQUENCY[frequency];
        return annualTakeHome / periodsPerYear;
    }
}

class ChartManager {
    constructor() {
        this.charts = {};
    }

    createTakeHomeChart(data) {
        const ctx = document.getElementById('takehomeChart').getContext('2d');
        
        if (this.charts.takehome) {
            this.charts.takehome.destroy();
        }

        this.charts.takehome = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Without 401K', 'With 401K'],
                datasets: [{
                    label: 'Annual Take-Home Pay',
                    data: [data.no401k.takeHomePay, data.with401k.takeHomePay],
                    backgroundColor: ['#ff6b6b', '#4ecdc4'],
                    borderColor: ['#ff5252', '#26a69a'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return FinancialCalculator.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return FinancialCalculator.formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }

    createWealthChart(data) {
        const ctx = document.getElementById('wealthChart').getContext('2d');
        
        if (this.charts.wealth) {
            this.charts.wealth.destroy();
        }

        this.charts.wealth = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Brokerage Account', '401K Account'],
                datasets: [{
                    label: 'Future Value',
                    data: [data.no401k.futureValue, data.with401k.futureValue],
                    backgroundColor: ['#ff9f43', '#10ac84'],
                    borderColor: ['#ff8c00', '#00b894'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return FinancialCalculator.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return FinancialCalculator.formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }

    createTaxChart(data) {
        const ctx = document.getElementById('taxChart').getContext('2d');
        
        if (this.charts.tax) {
            this.charts.tax.destroy();
        }

        this.charts.tax = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Federal Tax', 'State Tax', 'FICA Tax'],
                datasets: [{
                    data: [
                        data.with401k.taxes.federal,
                        data.with401k.taxes.state,
                        data.with401k.taxes.fica
                    ],
                    backgroundColor: ['#e74c3c', '#f39c12', '#3498db'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + FinancialCalculator.formatCurrency(context.parsed);
                            }
                        }
                    }
                }
            }
        });
    }
}

// Main application logic
class App {
    constructor() {
        this.chartManager = new ChartManager();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('calculateBtn').addEventListener('click', () => {
            this.calculate();
        });

        // Auto-calculate on input change
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.calculate();
            });
        });
    }

    getInputValues() {
        return {
            grossSalary: parseFloat(document.getElementById('grossSalary').value) || 0,
            contributionPercent: parseFloat(document.getElementById('contributionPercent').value) || 0,
            employerMatch: parseFloat(document.getElementById('employerMatch').value) || 0,
            investmentReturn: parseFloat(document.getElementById('investmentReturn').value) || 0,
            years: parseInt(document.getElementById('years').value) || 0,
            salaryFrequency: document.getElementById('salaryFrequency').value,
            withdrawalStrategy: document.getElementById('withdrawalStrategy').value,
            retirementIncome: parseFloat(document.getElementById('retirementIncome').value) || 0
        };
    }

    calculate() {
        const inputs = this.getInputValues();
        
        if (inputs.grossSalary <= 0) {
            return;
        }

        // Calculate scenarios
        const with401K = FinancialCalculator.calculate401KScenario(
            inputs.grossSalary,
            inputs.contributionPercent,
            inputs.employerMatch,
            inputs.investmentReturn,
            inputs.years
        );

        const no401K = FinancialCalculator.calculateNo401KScenario(
            inputs.grossSalary,
            inputs.contributionPercent,
            inputs.investmentReturn,
            inputs.years
        );

        // Calculate benefits
        const taxSavings = no401K.taxes.total - with401K.taxes.total;
        const wealthDifference = with401K.futureValue401K - no401K.futureValueBrokerage;
        const roi401K = (wealthDifference / (with401K.contribution * inputs.years)) * 100;

        // Calculate withdrawal taxes
        const withdrawalTaxes = FinancialCalculator.calculateWithdrawalTaxes(
            with401K.futureValue401K, 
            inputs.retirementIncome, 
            inputs.withdrawalStrategy,
            inputs.investmentReturn
        );

        // Update UI
        this.updateResults(no401K, with401K, taxSavings, wealthDifference, roi401K, inputs.salaryFrequency, withdrawalTaxes);
        this.updateContributionLimitViz(inputs.grossSalary, inputs.contributionPercent);
        
        // Create charts
        this.chartManager.createTakeHomeChart({
            no401k: { takeHomePay: no401K.takeHomePay },
            with401k: { takeHomePay: with401K.takeHomePay }
        });

        this.chartManager.createWealthChart({
            no401k: { futureValue: no401K.futureValueBrokerage },
            with401k: { futureValue: with401K.futureValue401K }
        });

        this.chartManager.createTaxChart({
            with401k: { taxes: with401K.taxes }
        });

        // Show results
        document.getElementById('resultsSection').style.display = 'block';
    }

    updateResults(no401K, with401K, taxSavings, wealthDifference, roi401K, salaryFrequency, withdrawalTaxes) {
        // Without 401K
        document.getElementById('takehomeNo401k').textContent = FinancialCalculator.formatCurrency(no401K.takeHomePay);
        document.getElementById('periodTakehomeNo401k').textContent = FinancialCalculator.formatCurrency(
            FinancialCalculator.getPeriodTakeHome(no401K.takeHomePay, salaryFrequency)
        );
        document.getElementById('taxesNo401k').textContent = FinancialCalculator.formatCurrency(no401K.taxes.total);
        document.getElementById('brokerageInvestment').textContent = FinancialCalculator.formatCurrency(no401K.afterTaxContribution);
        document.getElementById('futureValueBrokerage').textContent = FinancialCalculator.formatCurrency(no401K.futureValueBrokerage);

        // With 401K
        document.getElementById('takehomeWith401k').textContent = FinancialCalculator.formatCurrency(with401K.takeHomePay);
        document.getElementById('periodTakehomeWith401k').textContent = FinancialCalculator.formatCurrency(
            FinancialCalculator.getPeriodTakeHome(with401K.takeHomePay, salaryFrequency)
        );
        document.getElementById('taxesWith401k').textContent = FinancialCalculator.formatCurrency(with401K.taxes.total);
        document.getElementById('contribution401k').textContent = FinancialCalculator.formatCurrency(with401K.total401KContribution);
        document.getElementById('futureValue401k').textContent = FinancialCalculator.formatCurrency(with401K.futureValue401K);

        // Benefits
        document.getElementById('taxSavings').textContent = FinancialCalculator.formatCurrency(taxSavings);
        document.getElementById('wealthDifference').textContent = FinancialCalculator.formatCurrency(wealthDifference);
        document.getElementById('roi401k').textContent = FinancialCalculator.formatPercent(roi401K);

        // Withdrawal taxes
        document.getElementById('lumpSumTotal').textContent = FinancialCalculator.formatCurrency(withdrawalTaxes.lumpSum.total);
        document.getElementById('lumpSumTaxes').textContent = FinancialCalculator.formatCurrency(withdrawalTaxes.lumpSum.taxes);
        document.getElementById('lumpSumNet').textContent = FinancialCalculator.formatCurrency(withdrawalTaxes.lumpSum.net);
        document.getElementById('lumpSumTaxRate').textContent = FinancialCalculator.formatPercent(withdrawalTaxes.lumpSum.taxRate);

        document.getElementById('annualWithdrawal').textContent = FinancialCalculator.formatCurrency(withdrawalTaxes.annual.withdrawal);
        document.getElementById('annualTaxes').textContent = FinancialCalculator.formatCurrency(withdrawalTaxes.annual.taxes);
        document.getElementById('annualNet').textContent = FinancialCalculator.formatCurrency(withdrawalTaxes.annual.net);
        document.getElementById('annualTaxRate').textContent = FinancialCalculator.formatPercent(withdrawalTaxes.annual.taxRate);

        document.getElementById('monthlyWithdrawal').textContent = FinancialCalculator.formatCurrency(withdrawalTaxes.monthly.withdrawal);
        document.getElementById('monthlyTaxes').textContent = FinancialCalculator.formatCurrency(withdrawalTaxes.monthly.taxes);
        document.getElementById('monthlyNet').textContent = FinancialCalculator.formatCurrency(withdrawalTaxes.monthly.net);
        document.getElementById('monthlyTaxRate').textContent = FinancialCalculator.formatPercent(withdrawalTaxes.monthly.taxRate);
    }

    updateContributionLimitViz(grossSalary, contributionPercent) {
        const viz = document.getElementById('contributionLimitViz');
        const fill = document.getElementById('limitFill');
        const text = document.getElementById('limitText');
        
        if (grossSalary <= 0) {
            viz.style.display = 'none';
            return;
        }
        
        const requestedContribution = grossSalary * (contributionPercent / 100);
        const isCapped = requestedContribution > EMPLOYEE_401K_LIMIT;
        const actualContribution = Math.min(requestedContribution, EMPLOYEE_401K_LIMIT);
        
        // Show visualization
        viz.style.display = 'block';
        
        // Calculate percentage of limit used
        const limitPercentage = (actualContribution / EMPLOYEE_401K_LIMIT) * 100;
        
        // Update visual bar
        fill.style.width = `${Math.min(limitPercentage, 100)}%`;
        
        if (isCapped) {
            fill.classList.add('capped');
            text.textContent = `Capped at $${EMPLOYEE_401K_LIMIT.toLocaleString()} (${contributionPercent}% = $${requestedContribution.toLocaleString()})`;
        } else {
            fill.classList.remove('capped');
            text.textContent = `$${actualContribution.toLocaleString()} of $${EMPLOYEE_401K_LIMIT.toLocaleString()} limit`;
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
