const axios = require('axios');
const chalk = require('chalk');

const { beforeAll } = require('./beforeAll');

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

const [reqTime, testResults] = [[], []];

let [
  errorsCount,
  retCount,
  errorOverflowCount,
  reqTimeoutCount,
] = [0, 0, 0, 0];

const randInt = () => Math.floor(Math.random() * 100000);

const updateRequestTime = (time) => {
  reqTime.push(time);
};

const updateErrorsCount = (retCode) => {
  if (retCode) errorsCount += 1;
  else retCount += 1;
};

const checkErrors = () => {
  if (errorsCount / (retCount + errorsCount) >= 0.01) {
    errorOverflowCount += 1;
    console.log(errorsCount / (retCount + errorsCount));
    if (errorOverflowCount >= 3) {
      console.log(chalk.red(`Errors count exceeded: ${errorsCount} errors ocured`));
      process.exit(1);
    }
  } else {
    errorOverflowCount = 0;
  }

  reqTime.sort((a, b) => a - b);
  if (reqTime[Math.ceil(reqTime.length * 0.99) - 1] > 1000) {
    reqTimeoutCount += 1;
    if (reqTimeoutCount >= 3) {
      console.log(chalk.red(`Request timeout count exceeded: ${reqTimeoutCount} timeouts ocured`));
      process.exit(1);
    }
  } else {
    reqTimeoutCount = 0;
  }

  testResults.push({ times: reqTime.slice(), errorRate: errorsCount / (retCount + errorsCount) });

  retCount = 0;
  errorsCount = 0;
};

const requests = {
  redirect: {
    method: 'get',
    url: '/r/',
    validateStatus(status) {
      return status >= 200 && status < 400;
    },
    maxRedirects: 0,
  },
  shorten: {
    method: 'post',
    url: '/urls/shorten',
    data: { url: 'google.com' },
    headers: { Authorization: 'Bearer' },
  },
  signin: {
    method: 'post',
    url: '/users/signin',
    data: { email: 'kekw', password: 'password' },
  },
  signup: {
    method: 'post',
    url: '/users/signup',
    data: { email: '', password: 'password' },
  },
};

const getRequest = (randNum, usersCounter) => {
  if ((randNum % 100000) === 0) {
    const ret = requests.signup;

    ret.data.email = `kekw${usersCounter}`;
    return ret;
  }

  if ((randNum % 10000) === 0) {
    return requests.signin;
  }

  if ((randNum % 1000) === 0) {
    return requests.shorten;
  }

  return requests.redirect;
};

const setupRequests = (generatedToken, url) => {
  requests.redirect.url = `/r/${url}`;
  requests.shorten.headers = { Authorization: `Bearer ${generatedToken}` };
};

const QPS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const res = await beforeAll(axiosInstance);
  setupRequests(res.token, res.shortenedUrl);

  for (let i = 10; i <= QPS; i += 10) {
    const milliseconds = 1000 / i;

    console.log(chalk.green(`Current QPS: ${i}`));
    console.log(chalk.green(`Current miliseconds: ${milliseconds}\n`));

    const promiseArray = [];
    for (let j = 0; j < 30 * i; j += 1) {
      const request = getRequest(randInt(), `${i}${j}`);
      promiseArray.push(
        axiosInstance(request)
          .catch((err) => { console.log(err); }),
      );

      await sleep(milliseconds);
    }

    (await Promise.allSettled(promiseArray))
      .forEach((response) => {
        try {
          const time = response.value.headers['request-duration'];
          updateRequestTime(time);
          updateErrorsCount(0);

          return null;
        } catch (err) {
          updateRequestTime(10000);
          updateErrorsCount(1);

          return null;
        }
      });

    checkErrors();
  }
})();
