let ws;
let chartData = {};
let chart;
let candlestickSeries;
let smaLineSeries;
const smaPeriod = 20;
const symbolSelect = document.getElementById('symbolSelect');
const intervalSelect = document.getElementById('intervalSelect');
const currentPriceElement = document.getElementById('currentPrice');
const chartContainer = document.getElementById('chart');

function initChart() {
    const chartOptions = {
        layout: {
            backgroundColor: '#ffffff',
            textColor: 'rgba(33, 56, 77, 1)',
        },
        grid: {
            vertLines: { color: 'rgba(197, 203, 206, 0.5)' },
            horzLines: { color: 'rgba(197, 203, 206, 0.5)' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
    };

    chart = LightweightCharts.createChart(chartContainer, chartOptions);
    candlestickSeries = chart.addCandlestickSeries();
    smaLineSeries = chart.addLineSeries({
        color: 'rgba(4, 111, 232, 1)',
        lineWidth: 2,
    });

    function handleResize() {
        chart.applyOptions({ 
            width: chartContainer.clientWidth,
            height: 400
        });
    }

    window.addEventListener('resize', handleResize);
    handleResize();
}

function connectWebSocket() {
    const symbol = symbolSelect.value;
    const interval = intervalSelect.value;

    if (ws) {
        ws.close();
    }

    ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`);

    ws.onopen = () => console.log('WebSocket Connected');

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.e === 'kline') {
                const { t: time, o: open, h: high, l: low, c: close } = data.k;
                const newDataPoint = { 
                    time: time / 1000, 
                    open: parseFloat(open), 
                    high: parseFloat(high), 
                    low: parseFloat(low), 
                    close: parseFloat(close)
                };

                updateChartData(symbol, newDataPoint);
                updateCurrentPrice(close);
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };

    ws.onerror = (error) => console.error('WebSocket Error:', error);
    ws.onclose = () => console.log('WebSocket Disconnected');
}

function calculateSMA(data, period) {
    const sma = [];
    for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0);
        sma.push({
            time: data[i].time,
            value: sum / period,
        });
    }
    return sma;
}

function updateChartData(symbol, newDataPoint) {
    if (!chartData[symbol]) {
        chartData[symbol] = [];
    }

    const lastDataPoint = chartData[symbol][chartData[symbol].length - 1];

    if (lastDataPoint && lastDataPoint.time === newDataPoint.time) {
        chartData[symbol][chartData[symbol].length - 1] = newDataPoint;
    } else {
        chartData[symbol].push(newDataPoint);
    }

    if (chartData[symbol].length > 1000) {
        chartData[symbol] = chartData[symbol].slice(-1000);
    }

    if (chartData[symbol].length > smaPeriod) {
        const smaData = calculateSMA(chartData[symbol], smaPeriod);
        smaLineSeries.setData(smaData);
    }

    saveToLocalStorage(symbol, chartData[symbol]);
    updateChart();
}

function saveToLocalStorage(symbol, data) {
    try {
        localStorage.setItem(`chartData_${symbol}_${intervalSelect.value}`, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

function loadFromLocalStorage(symbol, interval) {
    try {
        const storedData = localStorage.getItem(`chartData_${symbol}_${interval}`);
        return storedData ? JSON.parse(storedData) : [];
    } catch (e) {
        console.error('Error loading from localStorage:', e);
        return [];
    }
}

function updateChart() {
    const symbol = symbolSelect.value;
    candlestickSeries.setData(chartData[symbol] || []);

    if (chartData[symbol] && chartData[symbol].length > smaPeriod) {
        const smaData = calculateSMA(chartData[symbol], smaPeriod);
        smaLineSeries.setData(smaData);
    }
}

function updateCurrentPrice(price) {
    currentPriceElement.textContent = `Current Price: ${parseFloat(price).toFixed(2)} USDT`;
}

function handleSymbolChange() {
    const symbol = symbolSelect.value;
    const interval = intervalSelect.value;
    chartData[symbol] = loadFromLocalStorage(symbol, interval);
    connectWebSocket();
    updateChart();
}

function handleIntervalChange() {
    handleSymbolChange();
}

function initializeApp() {
    initChart();
    symbolSelect.addEventListener('change', handleSymbolChange);
    intervalSelect.addEventListener('change', handleIntervalChange);
    handleSymbolChange();

    
}

document.addEventListener('DOMContentLoaded', initializeApp);