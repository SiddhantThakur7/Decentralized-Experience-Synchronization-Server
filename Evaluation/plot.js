const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

// Function to run the artillery command
function runArtilleryCommand(reportName, ymlName) {
    return new Promise((resolve, reject) => {
        exec(`artillery run --output ${reportName}.json ${ymlName}.yml`, (error, stdout, stderr) => {
            if (error) {
                reject(`Error executing command: ${error.message}`);
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }
            console.log(`stdout: ${stdout}`);
            resolve();
        });
    });
}

// Function to transform the data
function deserializeReport(reportName) {
    const rawData = fs.readFileSync(path.resolve('.', `${reportName}.json`));
    const data = JSON.parse(rawData);
    let result = {};
    let periods = [];

    data.intermediate.forEach(entry => {
        const period = entry.period;
        periods.push(period);
        Object.keys(entry.summaries).forEach(metric => {
            Object.keys(entry.summaries[metric]).forEach(subMetric => {
                const key = `${metric}-${subMetric}`;
                if (!result[key]) {
                    result[key] = [];
                }
                result[key].push(entry.summaries[metric][subMetric]);
            });
        });
    });

    return { periods, result };
}

// Function to plot selected metrics
async function plotMetrics(data, metric1, metric2, name1, name2, fileName, color = 'blue') {
    if (!data[metric1] || !data[metric2]) {
        console.log("One or both selected metrics are not available in the data.");
        return;
    }

    const width = 800;
    const height = 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const configuration = {
        type: 'line',
        data: {
            labels: data[metric1],
            datasets: [
                {
                    label: name2,
                    data: data[metric2],
                    borderColor: color,
                    fill: false
                }
            ]
        },
        options: {
            responsive: false,
            scales: {
                x: { title: { display: true, text: name1 } },
                y: { title: { display: true, text: name2 } }
            }
        }
    };

    const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync(`${fileName}.png`, imageBuffer);
    console.log(`Graph saved as ${fileName}.png`);
}

// Execute transformation



const loadTestSessionCreation = async () => {
    await runArtilleryCommand('session_creation_report', 'session_creation_load-test');
    const { periods, result } = deserializeReport('session_creation_report');

    // User selects two metrics
    const metric2 = "http.response_time-mean";
    const metric1 = "vusers.session_length-count";
    console.log(result);


    plotMetrics(result, metric1, metric2, 'Concurrency (requests per second)', 'Response Time (ms)', 'response_time_vs_concurrency');
}

const plotClientResults = async () => {
    const rawData = fs.readFileSync(path.resolve('.', 'client_results.json'));
    const data = JSON.parse(rawData);
    let metric1 = 'session_capacity';
    let metric2 = 'session_creation_latency';

    plotMetrics(data, metric1, metric2, 'Session Capacity (count)', 'Session Creation Time (ms)', 'session_capcity_vs_creation_time', 'black');

    metric1 = 'num_of_clients';
    metric2 = 'connection_latency';
    plotMetrics(data, metric1, metric2, 'Number of Peers (count)', 'Connection Time (ms)', 'number_of_peers_vs_connection_time', 'black');
}

loadTestSessionCreation()
    .then(() => console.log("Session Creation Load Test Completed"))
    .catch((err) => console.log(err));

plotClientResults();