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

let [data, headers, reqTime, testResults, errorsCount, retCount, errorOverflowCount, reqTimeoutCount, userCount] = [{}, {}, [], [], 0, 0, 0, 0, 0];

// const randInt = () => Math.floor(Math.random() * 100000);

const updateRequestTime = (time) => {
  reqTime.push(time);
  //if (time > 1000) {
  //  reqTimeoutCount += 1;
  //  if (reqTimeoutCount >= 3) {
  //    console.log(chalk.red(`Request timeout count exceeded: ${reqTimeoutCount} timeouts ocured`));
  //    process.exit(1);
  //  }
  //}
};

const updateErrorsCount = (retCode) => {
  if (retCode)
    retCount += 1;
  else
    errorsCount += 1;
};

const checkErrors = () => {
  if (errorsCount / retCount >= 0.01) {
    errorOverflowCount += 1;
    if (errorOverflowCount > 3) {
      console.log(chalk.red(`Errors count exceeded: ${errorsCount} errors ocured`));
      process.exit(1);
    }
  }
  errorOverflowCount = 0;
  reqTime.sort();
  if (reqTime[Math.ceil(reqTime.length * 0.99) - 1] > 1000) {
    reqTimeoutCount += 1;
    if (reqTimeoutCount > 3) {
      console.log(chalk.red(`Request timeout count exceeded: ${reqTimeoutCount} timeouts ocured`));
      process.exit(1);
    }
  }
  reqTimeoutCount = 0;

  testResults.push({ times: reqTime.slice(), errorRate: errorsCount / retCount });
};

const requests = {
  redirect : { method : axiosInstance.post,
               path : "/r/b",
               request : { }},
  shorten : { method : axiosInstance.post,
              path : "/url/shorten",
              request : { headers: { Authorization : `Bearer ${token}`},
                          url : "google.com"}},
  signin : { method : axiosInstance.post,
             path : "/user/signin",
             request : { email: "kekw", password: "password" }},
  signup : { method : axiosInstance.post,
             path : "/user/signup",
             request : { email: "", password: "password" }}
};

const getRequest = (randNum) => {
    if (randNum % 100000) {
        ret = requests.signup;
        ret.request.email = `kekw${userCount++}`;
        return ret;
    } else if (randNum % 10000) {
        return requests.signin;
    } else if (randNum % 1000) {
        return requests.shorten;
    } else {
        return requests.redirect;
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
	  request = getRequest(randInt());
      promiseArray.push(
        request.method(request.path, request.request)
        //axiosInstance.post('/users/signup', { email: `kekw${i}-${j}`, password: 'password' })
          // нам точно нужно считать ошибки и здесь и в конце?
          .catch(() => {
            updateErrorsCount(1);
          }),
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
