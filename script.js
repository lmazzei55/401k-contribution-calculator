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
    static calculate401KScenario(grossSalary, contributionPercent, employerMatch, investmentReturn, years, targetTakeHome = null, accountType = 'traditional' /* Unused */, roth401kMax = 0, rothIRA = 0) {
        const totalContributionAmount = Math.min(grossSalary * (contributionPercent / 100), EMPLOYEE_401K_LIMIT);
        const employerContribution = Math.min(grossSalary * (employerMatch / 100), totalContributionAmount);

        // Split total 401k contribution between Traditional and Roth
        const roth401kContribution = Math.min(totalContributionAmount, roth401kMax);
        const trad401kContribution = totalContributionAmount - roth401kContribution;

        // Roth IRA is a separate, post-tax contribution
        const rothIRAContribution = Math.min(rothIRA, 7000);

        // Only traditional 401k contributions reduce taxable income
        const taxableIncome = grossSalary - trad401kContribution;
        const taxes = TaxCalculator.calculateTotalTaxes(taxableIncome);
        
        // Calculate take-home pay
        let takeHomePay = taxableIncome - taxes.total;
        takeHomePay -= roth401kContribution; // Roth 401k is post-tax
        takeHomePay -= rothIRAContribution;  // Roth IRA is post-tax

        // Future value calculations for each bucket
        const futureValueTrad401k = this.calculateFutureValue(trad401kContribution, investmentReturn, years);
        const futureValueRoth401k = this.calculateFutureValue(roth401kContribution, investmentReturn, years);
        const futureValueEmployer = this.calculateFutureValue(employerContribution, investmentReturn, years);
        const futureValueRothIRA = this.calculateFutureValue(rothIRAContribution, investmentReturn, years);

        // Additional brokerage for excess take-home
        let additionalBrokerage = 0;
        if (targetTakeHome && takeHomePay > targetTakeHome) {
            additionalBrokerage = takeHomePay - targetTakeHome;
        }
        const futureValueAdditionalBrokerage = this.calculateFutureValue(additionalBrokerage, investmentReturn, years);
        
        return {
            contribution: totalContributionAmount,
            employerContribution,
            total401KContribution: totalContributionAmount + employerContribution,
            trad401kContribution,
            roth401kContribution,
            rothIRAContribution,
            additionalBrokerage,
            totalFutureValue: futureValueTrad401k + futureValueRoth401k + futureValueEmployer + futureValueRothIRA + futureValueAdditionalBrokerage,
            taxableIncome,
            taxes,
            takeHomePay,
            futureValueTrad401k,
            futureValueRoth401k,
            futureValueEmployerMatch: futureValueEmployer,
            futureValueRothIRA,
            futureValueAdditionalBrokerage,
            grossSalary
        };
    }

    static calculateNo401KScenario(grossSalary, contributionPercent, investmentReturn, years, targetTakeHome = null, rothIRA = 0) {
        const taxes = TaxCalculator.calculateTotalTaxes(grossSalary);
        let takeHomePay = grossSalary - taxes.total;

        // Roth IRA is a post-tax contribution
        const rothIRAContribution = Math.min(rothIRA, 7000);
        takeHomePay -= rothIRAContribution;
        const futureValueRothIRA = this.calculateFutureValue(rothIRAContribution, investmentReturn, years);

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
            futureValueBrokerage: futureValueBrokerage + futureValueRothIRA, // Combined post-tax investments
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

    static calculateCombinedWithdrawalTaxes(futureValueTrad, futureValueRoth, futureValueEmployer, futureValueRothIRA, futureValueBrokerage, retirementIncome, investmentReturn = 7, retirementYears = 20) {
        const results = {};
        const totalFutureValue = futureValueTrad + futureValueRoth + futureValueEmployer + futureValueRothIRA + futureValueBrokerage;

        // Lump Sum Withdrawal
        let lumpSumIncome = retirementIncome;
        lumpSumIncome += futureValueTrad; // Employee traditional contributions are pre-tax
        lumpSumIncome += futureValueEmployer; // Employer match is always pre-tax

        const incomeTaxes = TaxCalculator.calculateTotalTaxes(lumpSumIncome);
        const capitalGains = futureValueBrokerage;
        const longTermCapitalGainsRate = 0.20;
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
        
        const proportionTrad = totalFutureValue > 0 ? futureValueTrad / totalFutureValue : 0;
        const proportionRoth = totalFutureValue > 0 ? futureValueRoth / totalFutureValue : 0;
        const proportionEmployer = totalFutureValue > 0 ? futureValueEmployer / totalFutureValue : 0;
        const proportionRothIRA = totalFutureValue > 0 ? futureValueRothIRA / totalFutureValue : 0;
        const proportionBrokerage = totalFutureValue > 0 ? futureValueBrokerage / totalFutureValue : 0;

        const annualFromTrad = totalAnnualWithdrawal * proportionTrad;
        const annualFromRoth = totalAnnualWithdrawal * proportionRoth;
        const annualFromEmployer = totalAnnualWithdrawal * proportionEmployer;
        const annualFromRothIRA = totalAnnualWithdrawal * proportionRothIRA;
        const annualFromBrokerage = totalAnnualWithdrawal * proportionBrokerage;

        let annualTaxableIncome = retirementIncome;
        annualTaxableIncome += annualFromTrad;
        annualTaxableIncome += annualFromEmployer;
        
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

    static findMaxContributionForTarget(grossSalary, targetAnnualTakeHome, employerMatch, rothIRA = 0) {
        // Binary search to find the maximum contribution % that still meets target
        let low = 0;
        let high = Math.min(100, (EMPLOYEE_401K_LIMIT / grossSalary) * 100);
        let bestPercent = 0;
        
        for (let i = 0; i < 30; i++) {
            const mid = (low + high) / 2;
            const scenario = FinancialCalculator.calculate401KScenario(grossSalary, mid, employerMatch, 7, 30, targetAnnualTakeHome, 'traditional', 0, rothIRA);
            
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
        document.getElementById('calculateBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.calculate();
        });

        // Auto-calculate on input change for primary fields
        const inputs = document.querySelectorAll('#grossSalary, #contributionPercent, #employerMatch, #investmentReturn, #years, #retirementYears, #retirementIncome');
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
            solveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.solveContributionForTarget();
            });
        }

        const optimizerBtn = document.getElementById('findBestStrategyBtn');
        if(optimizerBtn) {
            optimizerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.findBestStrategy();
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
            retirementIncome: parseFloat(document.getElementById('retirementIncome').value) || 0,
            retirementYears: parseInt(document.getElementById('retirementYears').value) || 20,
            roth401kMax: parseFloat(document.getElementById('roth401kMax').value) || 0,
            rothIRA: parseFloat(document.getElementById('rothIRAContribution').value) || 0,
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
            targetAnnualTakeHome,
            'traditional', // This will be handled internally now
            inputs.roth401kMax,
            inputs.rothIRA
        );

        const no401K = FinancialCalculator.calculateNo401KScenario(
            inputs.grossSalary,
            inputs.contributionPercent,
            inputs.investmentReturn,
            inputs.years,
            targetAnnualTakeHome,
            inputs.rothIRA // Pass rothIRA contribution
        );

        // Calculate benefits
        const taxSavings = no401K.taxes.total - with401K.taxes.total;
        const wealthDifference = with401K.totalFutureValue - no401K.futureValueBrokerage;
        const roi401K = (wealthDifference / (with401K.contribution * inputs.years)) * 100;

        // Calculate withdrawal taxes
        const withdrawalTaxes = FinancialCalculator.calculateCombinedWithdrawalTaxes(
            with401K.futureValueTrad401k,
            with401K.futureValueRoth401k,
            with401K.futureValueEmployerMatch,
            with401K.futureValueRothIRA,
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
        const futureValueAtRetirement401k_employee = FinancialCalculator.calculateFutureValue(with401K.contribution, inputs.investmentReturn, inputs.years);
        const futureValueAtRetirement401k_employer = FinancialCalculator.calculateFutureValue(with401K.employerContribution, inputs.investmentReturn, inputs.years);
        const futureValueAtRetirementAddlBrokerage = FinancialCalculator.calculateFutureValue(with401K.additionalBrokerage, inputs.investmentReturn, inputs.years);
        
        const combinedTaxes = FinancialCalculator.calculateCombinedWithdrawalTaxes(
            futureValueAtRetirement401k_employee,
            futureValueAtRetirement401k_employer,
            futureValueAtRetirementAddlBrokerage, 
            inputs.retirementIncome, 
            inputs.investmentReturn, 
            inputs.retirementYears,
            inputs.accountType
        );
        withdrawalTaxes.lumpSum = combinedTaxes.lumpSum;
        withdrawalTaxes.annual = combinedTaxes.annual;


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
        const inputs = this.getInputValues();
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
        document.getElementById('no401k_years').textContent = inputs.years;
        
        // --- With 401K Scenario ---
        document.getElementById('with401k_grossSalary').textContent = FinancialCalculator.formatCurrency(with401K.grossSalary);
        document.getElementById('with401k_tradContribution').textContent = FinancialCalculator.formatCurrency(with401K.trad401kContribution);
        document.getElementById('with401k_taxableIncome').textContent = FinancialCalculator.formatCurrency(with401K.taxableIncome);
        document.getElementById('with401k_taxesPaid').textContent = FinancialCalculator.formatCurrency(with401K.taxes.total);
        document.getElementById('with401k_afterTaxIncome').textContent = FinancialCalculator.formatCurrency(with401K.taxableIncome - with401K.taxes.total);
        document.getElementById('with401k_rothContribution').textContent = FinancialCalculator.formatCurrency(with401K.roth401kContribution);
        document.getElementById('with401k_rothIRAContribution').textContent = FinancialCalculator.formatCurrency(with401K.rothIRAContribution);
        document.getElementById('with401k_netIncome').textContent = FinancialCalculator.formatCurrency(with401K.takeHomePay);
        document.getElementById('with401k_livingExpenses').textContent = targetAnnualTakeHome ? FinancialCalculator.formatCurrency(targetAnnualTakeHome) : '-';
        document.getElementById('with401k_totalInvestment').textContent = FinancialCalculator.formatCurrency(with401K.additionalBrokerage);
        
        document.getElementById('futureValueTrad401k').textContent = FinancialCalculator.formatCurrency(with401K.futureValueTrad401k);
        document.getElementById('futureValueRoth401k').textContent = FinancialCalculator.formatCurrency(with401K.futureValueRoth401k);
        document.getElementById('futureValueRothIRA').textContent = FinancialCalculator.formatCurrency(with401K.futureValueRothIRA);
        document.getElementById('futureValueBrokerageWith401k').textContent = FinancialCalculator.formatCurrency(with401K.futureValueAdditionalBrokerage);
        document.getElementById('futureValue401k').textContent = FinancialCalculator.formatCurrency(with401K.totalFutureValue);
        document.getElementById('with401k_years').textContent = inputs.years;

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
            inputs.employerMatch,
            inputs.rothIRA
        );

        // Check if target is achievable
        const scenarioAt0 = FinancialCalculator.calculate401KScenario(
            inputs.grossSalary, 0, inputs.employerMatch, inputs.investmentReturn, inputs.years, targetAnnualTakeHome, inputs.accountType, inputs.roth401kMax, inputs.rothIRA
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

    findBestStrategy() {
        const optimizerMessage = document.getElementById('optimizerMessage');
        optimizerMessage.textContent = 'Analyzing strategies...';

        setTimeout(() => {
            const inputs = this.getInputValues();
            const targetPerPay = parseFloat(document.getElementById('targetPerPay').value || '');
            const targetAnnualTakeHome = targetPerPay ? targetPerPay * SALARY_FREQUENCY[inputs.salaryFrequency] : null;
            const optimizerExplanation = document.getElementById('optimizerExplanation');
            optimizerExplanation.textContent = '';


            if (!targetAnnualTakeHome) {
                optimizerMessage.textContent = 'Please set a Target Take-home to find the best strategy.';
                return;
            }

            const maxTotalContributionPercent = FinancialCalculator.findMaxContributionForTarget(inputs.grossSalary, targetAnnualTakeHome, inputs.employerMatch, inputs.rothIRA);
            const totalContributionAmount = Math.min(inputs.grossSalary * (maxTotalContributionPercent / 100), EMPLOYEE_401K_LIMIT);

            // --- Simulate multiple scenarios to find the best and generate explanations ---
            const scenarios = {};
            
            // Pure Traditional
            const tradScenario = FinancialCalculator.calculate401KScenario(inputs.grossSalary, maxTotalContributionPercent, inputs.employerMatch, inputs.investmentReturn, inputs.years, targetAnnualTakeHome, '', 0, inputs.rothIRA);
            const tradWithdrawal = FinancialCalculator.calculateCombinedWithdrawalTaxes(tradScenario.futureValueTrad401k, tradScenario.futureValueRoth401k, tradScenario.futureValueEmployerMatch, tradScenario.futureValueRothIRA, tradScenario.futureValueAdditionalBrokerage, inputs.retirementIncome, inputs.investmentReturn, inputs.retirementYears);
            scenarios.traditional = { rothAmount: 0, netWorth: tradWithdrawal.lumpSum.net };

            // Pure Roth
            const maxRothAmount = Math.min(totalContributionAmount, inputs.roth401kMax);
            const rothScenario = FinancialCalculator.calculate401KScenario(inputs.grossSalary, maxTotalContributionPercent, inputs.employerMatch, inputs.investmentReturn, inputs.years, targetAnnualTakeHome, '', maxRothAmount, inputs.rothIRA);
            const rothWithdrawal = FinancialCalculator.calculateCombinedWithdrawalTaxes(rothScenario.futureValueTrad401k, rothScenario.futureValueRoth401k, rothScenario.futureValueEmployerMatch, rothScenario.futureValueRothIRA, rothScenario.futureValueAdditionalBrokerage, inputs.retirementIncome, inputs.investmentReturn, inputs.retirementYears);
            scenarios.roth = { rothAmount: maxRothAmount, netWorth: rothWithdrawal.lumpSum.net };

            let bestMix = {
                roth401kAmount: 0,
                netWorth: scenarios.traditional.netWorth,
                contributionPercent: maxTotalContributionPercent
            };

            // --- Iterate through other possible Roth 401K allocations ---
            for (let rothAmount = 500; rothAmount <= maxRothAmount; rothAmount += 500) {
                 const scenario = FinancialCalculator.calculate401KScenario(inputs.grossSalary, maxTotalContributionPercent, inputs.employerMatch, inputs.investmentReturn, inputs.years, targetAnnualTakeHome, '', rothAmount, inputs.rothIRA);
                 const withdrawal = FinancialCalculator.calculateCombinedWithdrawalTaxes(scenario.futureValueTrad401k, scenario.futureValueRoth401k, scenario.futureValueEmployerMatch, scenario.futureValueRothIRA, scenario.futureValueAdditionalBrokerage, inputs.retirementIncome, inputs.investmentReturn, inputs.retirementYears);
                
                if (withdrawal.lumpSum.net > bestMix.netWorth) {
                    bestMix = {
                        roth401kAmount: rothAmount,
                        netWorth: withdrawal.lumpSum.net,
                        contributionPercent: maxTotalContributionPercent
                    };
                }
            }
            
            // --- Set the optimal strategy and generate explanation ---
            document.getElementById('contributionPercent').value = bestMix.contributionPercent;
            document.getElementById('roth401kMax').value = bestMix.roth401kAmount;
            optimizerMessage.textContent = `Optimal Mix: ${bestMix.contributionPercent}% Total 401K, with ${FinancialCalculator.formatCurrency(bestMix.roth401kAmount)} to Roth 401K.`;
            
            const advantage = bestMix.netWorth - Math.max(scenarios.traditional.netWorth, scenarios.roth.netWorth);
            if (advantage > 100) {
                 optimizerExplanation.textContent = `This blended approach is projected to result in a final after-tax net worth of ${FinancialCalculator.formatCurrency(bestMix.netWorth)}, which is ${FinancialCalculator.formatCurrency(advantage)} more than the next best alternative.`;
            } else {
                optimizerExplanation.textContent = `This strategy is projected to result in a final after-tax net worth of ${FinancialCalculator.formatCurrency(bestMix.netWorth)}. The decision between Traditional and Roth is very close in your scenario.`;
            }


            this.calculate();
        }, 100); 
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
        document.getElementById('totalTrad401kInvestment').textContent = FinancialCalculator.formatCurrency(with401K.trad401kContribution);
        document.getElementById('totalRoth401kInvestment').textContent = FinancialCalculator.formatCurrency(with401K.roth401kContribution);
        document.getElementById('totalRothIRAInvestment').textContent = FinancialCalculator.formatCurrency(with401K.rothIRAContribution);
        document.getElementById('totalAdditionalBrokerage').textContent = FinancialCalculator.formatCurrency(with401K.additionalBrokerage || 0);
        
        const totalInvestment = with401K.trad401kContribution + with401K.roth401kContribution + with401K.rothIRAContribution + (with401K.additionalBrokerage || 0);
        document.getElementById('totalAnnualInvestment').textContent = FinancialCalculator.formatCurrency(totalInvestment);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
