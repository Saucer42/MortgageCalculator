let amortizationChart = null;

// Dark mode toggle
document.getElementById('darkModeToggle').addEventListener('change', function(e) {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    
    // Update chart if it exists
    if (amortizationChart) {
        updateChartTheme();
    }
});

function updateChartTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ffffff' : '#333333';
    
    amortizationChart.options.scales.x.ticks.color = textColor;
    amortizationChart.options.scales.y.ticks.color = textColor;
    amortizationChart.options.plugins.legend.labels.color = textColor;
    amortizationChart.update();
}

function toggleMortgageType(type) {
    const portedSection = document.getElementById('portedMortgageSection');
    const portedPaymentSection = document.getElementById('portedPaymentSection');
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    
    toggleBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(type)) {
            btn.classList.add('active');
        }
    });

    if (type === 'ported') {
        portedSection.style.display = 'block';
        portedPaymentSection.style.display = 'block';
    } else {
        portedSection.style.display = 'none';
        portedPaymentSection.style.display = 'none';
    }
}

function calculateMortgage() {
    // Get new mortgage values
    const loanAmount = parseFloat(document.getElementById('loanAmount').value) || 0;
    const annualInterestRate = parseFloat(document.getElementById('interestRate').value);
    const loanTermYears = parseInt(document.getElementById('loanTerm').value);
    const amortizationYears = parseInt(document.getElementById('amortization').value);

    // Get ported mortgage values
    const portedAmount = parseFloat(document.getElementById('portedAmount').value) || 0;
    const portedRate = parseFloat(document.getElementById('portedRate').value) || 0;
    const portedMonths = parseInt(document.getElementById('portedTermRemaining').value) || 0;
    const providedPortedPayment = parseFloat(document.getElementById('portedPayment').value);

    // Validate inputs
    if (!loanAmount || !annualInterestRate) {
        alert('Please fill in all required fields with valid numbers');
        return;
    }

    // Calculate payments
    const monthlyInterestRate = (annualInterestRate / 100) / 12;
    const totalPayments = amortizationYears * 12;
    const monthlyPayment = calculateMonthlyPayment(loanAmount, monthlyInterestRate, totalPayments);

    // Calculate ported mortgage initial payment
    let portedMonthlyPayment = 0;
    if (portedAmount && portedRate && portedMonths) {
        if (providedPortedPayment) {
            portedMonthlyPayment = providedPortedPayment;
        } else {
            const portedMonthlyRate = (portedRate / 100) / 12;
            portedMonthlyPayment = calculateMonthlyPayment(portedAmount, portedMonthlyRate, portedMonths);
        }
    }

    // Calculate totals for the term
    const termPayments = loanTermYears * 12;
    let totalPayment = 0;
    let totalInterest = 0;
    
    // Calculate amortization details including the renewal
    const { 
        totalTermPayment, 
        totalTermInterest,
        finalMonthlyPayment 
    } = calculateDetailedAmortization(
        loanAmount,
        portedAmount,
        monthlyInterestRate,
        (portedRate / 100) / 12,
        termPayments,
        portedMonths,
        totalPayments
    );

    totalPayment = totalTermPayment;
    totalInterest = totalTermInterest;

    // Display results
    document.getElementById('monthlyPayment').textContent = `$${monthlyPayment.toFixed(2)}`;
    document.getElementById('portedMonthlyPayment').textContent = `$${portedMonthlyPayment.toFixed(2)}`;
    document.getElementById('totalMonthlyPayment').textContent = 
        `$${(portedMonths > 0 ? portedMonthlyPayment + monthlyPayment : finalMonthlyPayment).toFixed(2)}`;
    
    if (portedMonths > 0 && portedMonths < termPayments) {
        const renewalNote = document.createElement('p');
        renewalNote.className = 'renewal-note';
        renewalNote.innerHTML = `Note: After month ${portedMonths}, payment adjusts to: $${finalMonthlyPayment.toFixed(2)}`;
        
        const paymentBreakdown = document.querySelector('.payment-breakdown');
        const existingNote = paymentBreakdown.querySelector('.renewal-note');
        if (existingNote) {
            existingNote.remove();
        }
        paymentBreakdown.appendChild(renewalNote);
    }

    document.getElementById('totalPayment').textContent = `$${totalPayment.toFixed(2)}`;
    document.getElementById('totalInterest').textContent = `$${totalInterest.toFixed(2)}`;

    // Update amortization schedule and chart
    updateAmortizationChart(loanAmount, portedAmount, monthlyInterestRate, (portedRate/100)/12, 
                          totalPayments, portedMonths);

    updateMortgageSummary(
        loanAmount,
        portedAmount,
        annualInterestRate,
        portedRate,
        loanTermYears,
        amortizationYears,
        portedMonths,
        monthlyPayment,
        portedMonthlyPayment,
        finalMonthlyPayment
    );
}

function calculateDetailedAmortization(newAmount, portedAmount, newRate, portedRate, termPayments, portedMonths, totalPayments) {
    let newBalance = newAmount;
    let portedBalance = portedAmount;
    let totalTermPayment = 0;
    let totalTermInterest = 0;
    let finalMonthlyPayment = 0;

    // Get the provided ported payment if available
    const providedPortedPayment = parseFloat(document.getElementById('portedPayment').value);

    // Calculate initial payments
    const newPayment = calculateMonthlyPayment(newAmount, newRate, totalPayments);
    const portedPayment = providedPortedPayment || 
        (portedAmount ? calculateMonthlyPayment(portedAmount, portedRate, portedMonths) : 0);

    // Process payments month by month for the term
    for (let month = 1; month <= termPayments; month++) {
        if (month <= portedMonths) {
            // Handle ported mortgage payment
            const portedInterest = portedBalance * portedRate;
            const portedPrincipal = portedPayment - portedInterest;
            portedBalance = Math.max(0, portedBalance - portedPrincipal);
            
            totalTermPayment += portedPayment;
            totalTermInterest += portedInterest;
        } else if (month === portedMonths + 1) {
            // Refinance the remaining ported balance at the new rate
            const remainingPayments = totalPayments - portedMonths;
            const refinancedPayment = calculateMonthlyPayment(portedBalance, newRate, remainingPayments);
            finalMonthlyPayment = newPayment + refinancedPayment;
        }

        // Handle new mortgage payment
        const newInterest = newBalance * newRate;
        const newPrincipal = newPayment - newInterest;
        newBalance = Math.max(0, newBalance - newPrincipal);
        
        totalTermPayment += newPayment;
        totalTermInterest += newInterest;
    }

    if (finalMonthlyPayment === 0) {
        finalMonthlyPayment = portedPayment + newPayment;
    }

    return { totalTermPayment, totalTermInterest, finalMonthlyPayment };
}

function calculateMonthlyPayment(principal, monthlyRate, numberOfPayments) {
    return principal * 
        (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
}

function updateAmortizationChart(newAmount, portedAmount, newRate, portedRate, totalPayments, portedMonths) {
    const ctx = document.getElementById('amortizationChart').getContext('2d');
    
    if (amortizationChart) {
        amortizationChart.destroy();
    }

    const data = calculateCombinedAmortizationSchedule(
        newAmount, portedAmount, newRate, portedRate, totalPayments, portedMonths
    );

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ffffff' : '#333333';

    amortizationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Ported Mortgage Balance',
                    data: data.portedBalances,
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.5)',
                    fill: true,
                    order: 1
                },
                {
                    label: 'New Mortgage Balance',
                    data: data.newBalances,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.5)',
                    fill: true,
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: textColor }
                },
                title: {
                    display: true,
                    text: 'Total Mortgage Balance Over Time',
                    color: textColor
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD'
                                }).format(context.parsed.y);
                            }
                            return label;
                        },
                        footer: function(tooltipItems) {
                            let total = 0;
                            tooltipItems.forEach(function(tooltipItem) {
                                total += tooltipItem.parsed.y;
                            });
                            return 'Total Balance: ' + 
                                new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD'
                                }).format(total);
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor }
                },
                y: {
                    stacked: true,
                    ticks: { 
                        color: textColor,
                        callback: function(value) {
                            return new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                maximumFractionDigits: 0
                            }).format(value);
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function calculateCombinedAmortizationSchedule(newAmount, portedAmount, newRate, portedRate, totalPayments, portedMonths) {
    const labels = [];
    const newBalances = [];
    const portedBalances = [];
    
    let newBalance = newAmount;
    let portedBalance = portedAmount;
    
    // Get the provided ported payment if available
    const providedPortedPayment = parseFloat(document.getElementById('portedPayment').value);
    
    let newPayment = calculateMonthlyPayment(newAmount, newRate, totalPayments);
    const portedPayment = providedPortedPayment || 
        (portedAmount ? calculateMonthlyPayment(portedAmount, portedRate, portedMonths) : 0);

    for (let month = 0; month <= totalPayments; month += 12) {
        labels.push(`Year ${month/12}`);
        newBalances.push(newBalance);
        portedBalances.push(portedBalance);

        // Calculate next year's balances
        for (let i = 0; i < 12 && month + i < totalPayments; i++) {
            if (month + i === portedMonths) {
                // Transfer remaining ported balance to new mortgage at new rate
                newBalance += portedBalance;
                // Recalculate payment for the combined balance
                const remainingPayments = totalPayments - portedMonths;
                newPayment = calculateMonthlyPayment(newBalance, newRate, remainingPayments);
                portedBalance = 0;
            }

            if (newBalance > 0) {
                const newInterest = newBalance * newRate;
                const newPrincipal = newPayment - newInterest;
                newBalance = Math.max(0, newBalance - newPrincipal);
            }

            if (portedBalance > 0 && month + i < portedMonths) {
                const portedInterest = portedBalance * portedRate;
                const portedPrincipal = portedPayment - portedInterest;
                portedBalance = Math.max(0, portedBalance - portedPrincipal);
            }
        }
    }

    return { labels, newBalances, portedBalances };
} 

function updateMortgageSummary(
    loanAmount, portedAmount, interestRate, portedRate, 
    termYears, amortizationYears, portedMonths, 
    monthlyPayment, portedPayment, finalMonthlyPayment
) {
    const formatCurrency = (amount) => 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    
    const formatPercent = (rate) => 
        new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2 }).format(rate/100);

    // Scenario Summary
    const scenarioHTML = `
        <ul>
            <li>New Mortgage Amount: <span class="summary-highlight">${formatCurrency(loanAmount)}</span></li>
            ${portedAmount ? `
                <li>Ported Mortgage Amount: <span class="summary-highlight">${formatCurrency(portedAmount)}</span></li>
                <li>Total Borrowed: <span class="summary-highlight">${formatCurrency(loanAmount + portedAmount)}</span></li>
            ` : ''}
            <li>New Mortgage Rate: <span class="summary-highlight">${formatPercent(interestRate)}</span></li>
            ${portedAmount ? `
                <li>Ported Mortgage Rate: <span class="summary-highlight">${formatPercent(portedRate)}</span></li>
            ` : ''}
        </ul>
    `;

    // Payment Summary
    const paymentHTML = `
        <ul>
            <li>Initial New Mortgage Payment: <span class="summary-highlight">${formatCurrency(monthlyPayment)}</span></li>
            ${portedAmount ? `
                <li>Ported Mortgage Payment: <span class="summary-highlight">${formatCurrency(portedPayment)}</span></li>
                <li>Initial Combined Payment: <span class="summary-highlight">${formatCurrency(monthlyPayment + portedPayment)}</span></li>
                <li>Payment After Ported Term: <span class="summary-highlight">${formatCurrency(finalMonthlyPayment)}</span></li>
            ` : ''}
        </ul>
    `;

    // Key Dates
    const today = new Date();
    const portedEndDate = new Date(today.setMonth(today.getMonth() + portedMonths));
    const termEndDate = new Date(today.setMonth(today.getMonth() + (termYears * 12 - portedMonths)));
    const amortizationEndDate = new Date(today.setMonth(today.getMonth() + (amortizationYears * 12 - termYears * 12)));

    const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const datesHTML = `
        <ul>
            ${portedAmount ? `
                <li>Ported Mortgage Renewal: <span class="summary-highlight">${formatDate(portedEndDate)}</span></li>
            ` : ''}
            <li>Term End Date: <span class="summary-highlight">${formatDate(termEndDate)}</span></li>
            <li>Amortization End Date: <span class="summary-highlight">${formatDate(amortizationEndDate)}</span></li>
        </ul>
    `;

    // Assumptions
    const assumptionsHTML = `
        <ul>
            <li>Payments are made monthly</li>
            <li>Interest is compounded semi-annually (Canadian standard)</li>
            <li>No additional payments or prepayments</li>
            <li>Payment amounts remain constant during their respective terms</li>
            <li>Interest rates remain constant during their respective terms</li>
            ${portedAmount ? `
                <li>Ported mortgage balance will be refinanced at the new rate after the ported term</li>
                <li>Ported mortgage maintains its current payment schedule</li>
            ` : ''}
        </ul>
    `;

    // Update the DOM
    document.getElementById('scenarioSummary').innerHTML = scenarioHTML;
    document.getElementById('paymentSummary').innerHTML = paymentHTML;
    document.getElementById('datesSummary').innerHTML = datesHTML;
    document.getElementById('assumptions').innerHTML = assumptionsHTML;
} 