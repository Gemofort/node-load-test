const beforeAll = async (axiosInstance) => {
  await axiosInstance.post('/users/signup', { email: 'kekw', password: 'password' });
  const { data } = await axiosInstance.post('/users/signin', { email: 'kekw', password: 'password' });

  const token = data.access_token;

  const urlShortenRes = await axiosInstance.post('/urls/shorten', { url: 'https://google.com' }, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return { token, shortenedUrl: urlShortenRes.data.shortened_url };
};

module.exports = { beforeAll };
