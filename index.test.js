const axios = require('axios');
const chalk = require('chalk');

const axiosConfig = { baseURL: 'http://127.0.0.1:8080' };
const axiosInstance = axios.create(axiosConfig);

axiosInstance.interceptors.request.use((config) => {
  // eslint-disable-next-line no-param-reassign
  config.headers['request-startTime'] = process.hrtime();
  return config;
});

axiosInstance.interceptors.response.use((response) => {
  const start = response.config.headers['request-startTime'];
  const end = process.hrtime(start);
  const milliseconds = Math.round((end[0] * 1000) + (end[1] / 1000000));
  response.headers['request-duration'] = milliseconds;
  return response;
});

let [data, headers, errorsCount, reqTimeoutCount] = [{}, {}, 0, 0];

// const randInt = () => Math.floor(Math.random() * 100000);

const checkRequestTimeout = (time) => {
  if (time > 1000) {
    reqTimeoutCount += 1;
    if (reqTimeoutCount >= 3) {
      console.log(chalk.red(`Request timeout count exceeded: ${reqTimeoutCount} timeouts ocured`));
      process.exit(1);
    }
  }
};

const checkErrorsCount = () => {
  errorsCount += 1;
  if (errorsCount >= 3) {
    console.log(chalk.red(`Errors count exceeded: ${errorsCount} errors ocured`));
    process.exit(1);
  }
};

const QPS = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  for (let i = 10; i <= QPS; i += 10) {
    const milliseconds = 1000 / i;

    console.log(chalk.green(`Current QPS: ${i}`));
    console.log(chalk.green(`Current miliseconds: ${milliseconds}\n`));

    const promiseArray = [];
    for (let j = 0; j < 30 * i; j += 1) {
      promiseArray.push(
        axiosInstance.post('/users/signup', { email: `kekw${i}-${j}`, password: 'password' })
          .catch(() => {
            checkErrorsCount();
          }),
      );
      await sleep(milliseconds);
    }

    (await Promise.allSettled(promiseArray))
      .forEach((response) => {
        try {
          const time = response.value.headers['request-duration'];
          checkRequestTimeout(time);

          return null;
        } catch (err) {
          checkErrorsCount();

          return null;
        }
      });
  }
})();
