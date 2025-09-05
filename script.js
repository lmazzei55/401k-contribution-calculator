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
    static calculate401KScenario(grossSalary, contributionPercent, employerMatch, investmentReturn, years, targetTakeHome = null) {
        // Calculate contribution amount, respecting 401K limits
        const maxContribution = Math.min(grossSalary * (contributionPercent / 100), EMPLOYEE_401K_LIMIT);
        const employerContribution = Math.min(grossSalary * (employerMatch / 100), EMPLOYEE_401K_LIMIT * 0.5); // Typical employer match limit
        const total401KContribution = maxContribution + employerContribution;
        
        // Taxable income after 401K contribution
        const taxableIncome = grossSalary - maxContribution;
        const taxes = TaxCalculator.calculateTotalTaxes(taxableIncome);
        const takeHomePay = taxableIncome - taxes.total;
        
        // Calculate additional brokerage investment if we have excess beyond target
        let additionalBrokerage = 0;
        if (targetTakeHome && takeHomePay > targetTakeHome) {
            additionalBrokerage = takeHomePay - targetTakeHome;
        }
        
        // Future value of 401K (tax-deferred)
        const futureValue401K = this.calculateFutureValue(total401KContribution, investmentReturn, years);
        
        // Future value of additional brokerage investment
        const futureValueAdditionalBrokerage = this.calculateFutureValue(additionalBrokerage, investmentReturn, years);
        
        return {
            contribution: maxContribution,
            employerContribution,
            total401KContribution,
            additionalBrokerage,
            totalFutureValue: futureValue401K + futureValueAdditionalBrokerage,
            taxableIncome,
            taxes,
            takeHomePay,
            futureValue401K,
            futureValueAdditionalBrokerage,
            grossSalary
        };
    }

    static calculateNo401KScenario(grossSalary, contributionPercent, investmentReturn, years, targetTakeHome = null) {
        const taxes = TaxCalculator.calculateTotalTaxes(grossSalary);
        const takeHomePay = grossSalary - taxes.total;
        
        // Calculate brokerage investment
        let brokerageInvestment = 0;
        if (targetTakeHome) {
            // If we have excess beyond target, invest it
            if (takeHomePay > targetTakeHome) {
                brokerageInvestment = takeHomePay - targetTakeHome;
            }
        } else {
            // Without target, we invest what would have been the 401K contribution (after-tax)
            const potentialContribution = Math.min(grossSalary * (contributionPercent / 100), EMPLOYEE_401K_LIMIT);
            brokerageInvestment = potentialContribution * (1 - (taxes.federal + taxes.state) / grossSalary);
        }
        
        // Future value of brokerage investment (after-tax)
        const futureValueBrokerage = this.calculateFutureValue(brokerageInvestment, investmentReturn, years);
        
        return {
            taxes,
            takeHomePay,
            brokerageInvestment,
            futureValueBrokerage,
            grossSalary
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

    static calculateCombinedWithdrawalTaxes(futureValue401k, futureValueBrokerage, retirementIncome, investmentReturn = 7, retirementYears = 20) {
        const results = {};
        const totalFutureValue = futureValue401k + futureValueBrokerage;

        // Lump Sum Withdrawal
        const lumpSumIncome = futureValue401k + retirementIncome;
        const incomeTaxes = TaxCalculator.calculateTotalTaxes(lumpSumIncome);
        const capitalGains = futureValueBrokerage;
        const longTermCapitalGainsRate = 0.20; // Simplified rate
        const capitalGainsTaxes = capitalGains * longTermCapitalGainsRate;
        const totalLumpSumTaxes = incomeTaxes.total + capitalGainsTaxes;

        results.lumpSum = {
            total: totalFutureValue,
            taxes: totalLumpSumTaxes,
            net: totalFutureValue - totalLumpSumTaxes,
            taxRate: totalFutureValue > 0 ? (totalLumpSumTaxes / totalFutureValue) * 100 : 0
        };

        // Annual Withdrawals
        const annualReturn = investmentReturn / 100;
        const totalAnnualWithdrawal = this.calculateAnnualWithdrawal(totalFutureValue, annualReturn, retirementYears);
        
        const proportion401k = totalFutureValue > 0 ? futureValue401k / totalFutureValue : 0;
        const annualFrom401k = totalAnnualWithdrawal * proportion401k;
        const annualFromBrokerage = totalAnnualWithdrawal * (1 - proportion401k);

        const annualTaxableIncome = annualFrom401k + retirementIncome;
        const annualIncomeTaxes = TaxCalculator.calculateTotalTaxes(annualTaxableIncome);

        const annualCapitalGains = annualFromBrokerage * 0.7; // Assume 70% is gains
        const annualCapitalGainsTaxes = annualCapitalGains * longTermCapitalGainsRate;
        const totalAnnualTaxes = annualIncomeTaxes.total + annualCapitalGainsTaxes;

        results.annual = {
            withdrawal: totalAnnualWithdrawal,
            taxes: totalAnnualTaxes,
            net: totalAnnualWithdrawal - totalAnnualTaxes,
            taxRate: totalAnnualWithdrawal > 0 ? (totalAnnualTaxes / totalAnnualWithdrawal) * 100 : 0
        };
        
        return results;
    }

    static calculateBrokerageWithdrawalTaxes(futureValueBrokerage, retirementIncome, investmentReturn = 7, retirementYears = 20) {
        const results = {};
        
        // Lump sum withdrawal - only capital gains are taxed
        const capitalGains = futureValueBrokerage; // Assuming all growth is capital gains
        const longTermCapitalGainsRate = 0.20; // 20% for high earners, 15% for most people
        const lumpSumCapitalGainsTax = capitalGains * longTermCapitalGainsRate;
        
        results.lumpSum = {
            total: futureValueBrokerage,
            taxes: lumpSumCapitalGainsTax,
            net: futureValueBrokerage - lumpSumCapitalGainsTax,
            taxRate: (lumpSumCapitalGainsTax / futureValueBrokerage) * 100
        };
        
        // Annual withdrawals with continued earnings
        const annualReturn = investmentReturn / 100;
        const annualWithdrawal = this.calculateAnnualWithdrawal(futureValueBrokerage, annualReturn, retirementYears);
        
        // For annual withdrawals, only the growth portion is taxed as capital gains
        const annualCapitalGains = annualWithdrawal * 0.7; // Assume 70% is growth, 30% is principal
        const annualCapitalGainsTax = annualCapitalGains * longTermCapitalGainsRate;
        
        results.annual = {
            withdrawal: annualWithdrawal,
            taxes: annualCapitalGainsTax,
            net: annualWithdrawal - annualCapitalGainsTax,
            taxRate: (annualCapitalGainsTax / annualWithdrawal) * 100
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

    static findMaxContributionForTarget(grossSalary, targetAnnualTakeHome, employerMatch) {
        // Binary search to find the maximum contribution % that still meets target
        let low = 0;
        let high = Math.min(100, (EMPLOYEE_401K_LIMIT / grossSalary) * 100);
        let bestPercent = 0;
        
        for (let i = 0; i < 30; i++) {
            const mid = (low + high) / 2;
            const scenario = this.calculate401KScenario(grossSalary, mid, employerMatch, 7, 30, targetAnnualTakeHome);
            
            // Check if this contribution % allows us to meet the target take-home
            if (scenario.takeHomePay >= targetAnnualTakeHome - 1) {
                // This contribution % still meets target
                bestPercent = mid;
                low = mid;
            } else {
                // This contribution % is too high
                high = mid;
            }
        }
        
        return Math.round(bestPercent * 10) / 10;
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
                aspectRatio: 1.5,
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
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10
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
                aspectRatio: 1.5,
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
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10
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
                aspectRatio: 1,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + FinancialCalculator.formatCurrency(context.parsed);
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10
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

        // Recalculate on select changes
        const selects = document.querySelectorAll('select');
        selects.forEach(sel => {
            sel.addEventListener('change', () => {
                this.calculate();
            });
        });

        // Inverse solver handler
        const solveBtn = document.getElementById('solveContributionBtn');
        if (solveBtn) {
            solveBtn.addEventListener('click', () => {
                this.solveContributionForTarget();
            });
        }
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
            retirementIncome: parseFloat(document.getElementById('retirementIncome').value) || 0,
            retirementYears: parseInt(document.getElementById('retirementYears').value) || 20
        };
    }

    calculate() {
        const inputs = this.getInputValues();
        
        if (inputs.grossSalary <= 0) {
            return;
        }

        // Get target annual take-home if specified
        const targetPerPay = parseFloat(document.getElementById('targetPerPay').value || '');
        const targetAnnualTakeHome = targetPerPay ? targetPerPay * SALARY_FREQUENCY[inputs.salaryFrequency] : null;

        // Calculate scenarios
        const with401K = FinancialCalculator.calculate401KScenario(
            inputs.grossSalary,
            inputs.contributionPercent,
            inputs.employerMatch,
            inputs.investmentReturn,
            inputs.years,
            targetAnnualTakeHome
        );

        const no401K = FinancialCalculator.calculateNo401KScenario(
            inputs.grossSalary,
            inputs.contributionPercent,
            inputs.investmentReturn,
            inputs.years,
            targetAnnualTakeHome
        );

        // Calculate benefits
        const taxSavings = no401K.taxes.total - with401K.taxes.total;
        const wealthDifference = with401K.totalFutureValue - no401K.futureValueBrokerage;
        const roi401K = (wealthDifference / (with401K.contribution * inputs.years)) * 100;

        // Calculate withdrawal taxes
        const withdrawalTaxes = FinancialCalculator.calculateCombinedWithdrawalTaxes(
            with401K.futureValue401K,
            with401K.futureValueAdditionalBrokerage,
            inputs.retirementIncome, 
            inputs.investmentReturn,
            inputs.retirementYears
        );

        // Calculate brokerage withdrawal taxes
        const brokerageWithdrawalTaxes = FinancialCalculator.calculateBrokerageWithdrawalTaxes(
            no401K.futureValueBrokerage,
            inputs.retirementIncome,
            inputs.investmentReturn,
            inputs.retirementYears
        );

        // For the lump sum, we need the future value at the start of retirement
        const futureValueAtRetirement401k = FinancialCalculator.calculateFutureValue(with401K.total401KContribution, inputs.investmentReturn, inputs.years);
        const futureValueAtRetirementAddlBrokerage = FinancialCalculator.calculateFutureValue(with401K.additionalBrokerage, inputs.investmentReturn, inputs.years);
        
        const combinedTaxes = FinancialCalculator.calculateCombinedWithdrawalTaxes(
            futureValueAtRetirement401k, 
            futureValueAtRetirementAddlBrokerage, 
            inputs.retirementIncome, 
            inputs.investmentReturn, 
            inputs.retirementYears
        );
        withdrawalTaxes.lumpSum = combinedTaxes.lumpSum;


        const futureValueAtRetirementBrokerage = FinancialCalculator.calculateFutureValue(no401K.brokerageInvestment, inputs.investmentReturn, inputs.years);
        const capitalGains = futureValueAtRetirementBrokerage; // Assuming all growth is capital gains
        const longTermCapitalGainsRate = 0.20; // 20% for high earners, 15% for most people
        const lumpSumCapitalGainsTax = capitalGains * longTermCapitalGainsRate;
        brokerageWithdrawalTaxes.lumpSum = {
            total: futureValueAtRetirementBrokerage,
            taxes: lumpSumCapitalGainsTax,
            net: futureValueAtRetirementBrokerage - lumpSumCapitalGainsTax,
            taxRate: futureValueAtRetirementBrokerage > 0 ? (lumpSumCapitalGainsTax / futureValueAtRetirementBrokerage) * 100 : 0
        };
        
        // Update UI
        this.updateResults(no401K, with401K, taxSavings, wealthDifference, roi401K, inputs.salaryFrequency, withdrawalTaxes, brokerageWithdrawalTaxes);
        this.updateContributionLimitViz(inputs.grossSalary, inputs.contributionPercent);
        this.updateMaxContributionInfo(inputs, targetAnnualTakeHome);
        this.updateTargetInfoSection(inputs, targetAnnualTakeHome, with401K, no401K);
        
        // Create charts
        this.chartManager.createTakeHomeChart({
            no401k: { takeHomePay: no401K.takeHomePay },
            with401k: { takeHomePay: with401K.takeHomePay }
        });

        this.chartManager.createWealthChart({
            no401k: { futureValue: no401K.futureValueBrokerage },
            with401k: { futureValue: with401K.totalFutureValue }
        });

        this.chartManager.createTaxChart({
            with401k: { taxes: with401K.taxes }
        });

        // Show results
        document.getElementById('resultsSection').style.display = 'block';
    }

    updateResults(no401K, with401K, taxSavings, wealthDifference, roi401K, salaryFrequency, withdrawalTaxes, brokerageWithdrawalTaxes) {
        const targetPerPay = parseFloat(document.getElementById('targetPerPay').value || '');
        const targetAnnualTakeHome = targetPerPay ? targetPerPay * SALARY_FREQUENCY[salaryFrequency] : null;

        // --- Without 401K Scenario ---
        document.getElementById('no401k_grossSalary').textContent = FinancialCalculator.formatCurrency(no401K.grossSalary);
        document.getElementById('no401k_taxableIncome').textContent = FinancialCalculator.formatCurrency(no401K.grossSalary);
        document.getElementById('no401k_taxesPaid').textContent = FinancialCalculator.formatCurrency(no401K.taxes.total);
        document.getElementById('no401k_netIncome').textContent = FinancialCalculator.formatCurrency(no401K.takeHomePay);
        document.getElementById('no401k_livingExpenses').textContent = targetAnnualTakeHome ? FinancialCalculator.formatCurrency(targetAnnualTakeHome) : '-';
        document.getElementById('no401k_totalInvestment').textContent = FinancialCalculator.formatCurrency(no401K.brokerageInvestment);
        document.getElementById('futureValueBrokerage').textContent = FinancialCalculator.formatCurrency(no401K.futureValueBrokerage);
        document.getElementById('no401k_totalFutureValue').textContent = FinancialCalculator.formatCurrency(no401K.futureValueBrokerage);
        
        // --- With 401K Scenario ---
        document.getElementById('with401k_grossSalary').textContent = FinancialCalculator.formatCurrency(with401K.grossSalary);
        document.getElementById('with401k_contribution').textContent = FinancialCalculator.formatCurrency(with401K.contribution);
        document.getElementById('with401k_taxableIncome').textContent = FinancialCalculator.formatCurrency(with401K.taxableIncome);
        document.getElementById('with401k_taxesPaid').textContent = FinancialCalculator.formatCurrency(with401K.taxes.total);
        document.getElementById('with401k_netIncome').textContent = FinancialCalculator.formatCurrency(with401K.takeHomePay);
        document.getElementById('with401k_livingExpenses').textContent = targetAnnualTakeHome ? FinancialCalculator.formatCurrency(targetAnnualTakeHome) : '-';
        document.getElementById('with401k_totalInvestment').textContent = FinancialCalculator.formatCurrency(with401K.additionalBrokerage);
        document.getElementById('futureValue401kOnly').textContent = FinancialCalculator.formatCurrency(with401K.futureValue401K);
        document.getElementById('futureValueBrokerageWith401k').textContent = FinancialCalculator.formatCurrency(with401K.futureValueAdditionalBrokerage);
        document.getElementById('futureValue401k').textContent = FinancialCalculator.formatCurrency(with401K.totalFutureValue);

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

        // Brokerage withdrawal taxes
        document.getElementById('brokerageLumpSumTotal').textContent = FinancialCalculator.formatCurrency(brokerageWithdrawalTaxes.lumpSum.total);
        document.getElementById('brokerageLumpSumTaxes').textContent = FinancialCalculator.formatCurrency(brokerageWithdrawalTaxes.lumpSum.taxes);
        document.getElementById('brokerageLumpSumNet').textContent = FinancialCalculator.formatCurrency(brokerageWithdrawalTaxes.lumpSum.net);
        document.getElementById('brokerageLumpSumTaxRate').textContent = FinancialCalculator.formatPercent(brokerageWithdrawalTaxes.lumpSum.taxRate);

        document.getElementById('brokerageAnnualWithdrawal').textContent = FinancialCalculator.formatCurrency(brokerageWithdrawalTaxes.annual.withdrawal);
        document.getElementById('brokerageAnnualTaxes').textContent = FinancialCalculator.formatCurrency(brokerageWithdrawalTaxes.annual.taxes);
        document.getElementById('brokerageAnnualNet').textContent = FinancialCalculator.formatCurrency(brokerageWithdrawalTaxes.annual.net);
        document.getElementById('brokerageAnnualTaxRate').textContent = FinancialCalculator.formatPercent(brokerageWithdrawalTaxes.annual.taxRate);
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
            text.textContent = `Capped at $${EMPLOYEE_401K_LIMIT.toLocaleString()}`;
            text.classList.add('small');
        } else {
            fill.classList.remove('capped');
            text.textContent = `$${actualContribution.toLocaleString()} of $${EMPLOYEE_401K_LIMIT.toLocaleString()}`;
            text.classList.remove('small');
        }
    }

    solveContributionForTarget() {
        const messageEl = document.getElementById('solveMessage');
        const targetPerPay = parseFloat(document.getElementById('targetPerPay').value || '');
        const inputs = this.getInputValues();
        messageEl.textContent = '';

        if (!targetPerPay || targetPerPay <= 0) {
            messageEl.textContent = 'Enter a valid per-paycheck amount.';
            return;
        }

        const targetAnnualTakeHome = targetPerPay * SALARY_FREQUENCY[inputs.salaryFrequency];
        
        // Find the maximum contribution % that still meets the target
        const maxContributionPercent = FinancialCalculator.findMaxContributionForTarget(
            inputs.grossSalary, 
            targetAnnualTakeHome, 
            inputs.employerMatch
        );

        // Check if target is achievable
        const scenarioAt0 = FinancialCalculator.calculate401KScenario(
            inputs.grossSalary, 0, inputs.employerMatch, inputs.investmentReturn, inputs.years, targetAnnualTakeHome
        );
        
        if (targetPerPay >= FinancialCalculator.getPeriodTakeHome(scenarioAt0.takeHomePay, inputs.salaryFrequency) - 1) {
            document.getElementById('contributionPercent').value = 0;
            this.calculate();
            messageEl.textContent = 'Target exceeds 0% contribution take-home; set to 0%.';
            return;
        }

        if (maxContributionPercent <= 0.1) {
            document.getElementById('contributionPercent').value = 0;
            this.calculate();
            messageEl.textContent = 'Target requires 0% contribution to meet take-home goal.';
            return;
        }

        // Set to the maximum contribution that still meets target
        document.getElementById('contributionPercent').value = maxContributionPercent;
        this.calculate();
        messageEl.textContent = `Max contribution ${maxContributionPercent}% while meeting target.`;
    }

    updateMaxContributionInfo(inputs, targetAnnualTakeHome) {
        const maxInfoEl = document.getElementById('maxContributionInfo');
        
        if (!targetAnnualTakeHome) {
            maxInfoEl.style.display = 'none';
            return;
        }

        const maxContributionPercent = FinancialCalculator.findMaxContributionForTarget(
            inputs.grossSalary, 
            targetAnnualTakeHome, 
            inputs.employerMatch
        );

        maxInfoEl.style.display = 'block';
        maxInfoEl.textContent = `Max contribution: ${maxContributionPercent}% while meeting target take-home`;
    }

    updateTargetInfoSection(inputs, targetAnnualTakeHome, with401K, no401K) {
        const targetInfoSection = document.getElementById('targetInfoSection');
        
        if (!targetAnnualTakeHome) {
            targetInfoSection.style.display = 'none';
            return;
        }

        // Show the section
        targetInfoSection.style.display = 'block';

        // Update target information
        const targetPerPay = parseFloat(document.getElementById('targetPerPay').value || '');
        document.getElementById('targetPerPaycheck').textContent = FinancialCalculator.formatCurrency(targetPerPay);
        document.getElementById('targetAnnualTakeHome').textContent = FinancialCalculator.formatCurrency(targetAnnualTakeHome);
        
        // Update salary frequency display
        const frequencyLabels = {
            weekly: 'Weekly (52 periods/year)',
            biweekly: 'Bi-weekly (26 periods/year)',
            semimonthly: 'Semi-monthly (24 periods/year)',
            monthly: 'Monthly (12 periods/year)',
            annually: 'Annually (1 period/year)'
        };
        document.getElementById('salaryFrequencyDisplay').textContent = frequencyLabels[inputs.salaryFrequency] || inputs.salaryFrequency;

        // Update investment breakdown
        document.getElementById('total401kInvestment').textContent = FinancialCalculator.formatCurrency(with401K.total401KContribution);
        document.getElementById('totalAdditionalBrokerage').textContent = FinancialCalculator.formatCurrency(with401K.additionalBrokerage || 0);
        
        const totalInvestment = with401K.total401KContribution + (with401K.additionalBrokerage || 0);
        document.getElementById('totalAnnualInvestment').textContent = FinancialCalculator.formatCurrency(totalInvestment);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
