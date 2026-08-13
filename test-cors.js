async function test() {
  const imageUrl = "http://sun9-88.userapi.com/s/v1/ig2/yAxNvzoDYu5t8AuJb_JpPoDJHQNZQIFi4kwdiNo6pG_-Nwq_EyCPET6qJDCrrIMcppLS8tsL67TksaK4X5qPC8xA.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080,1280x1280,1440x1440,2560x2560&from=bu&cs=640x0";
  try {
      const imgRes = await fetch(imageUrl, {
        method: 'OPTIONS'
      })
      console.log('OPTIONS headers:', Array.from(imgRes.headers.entries()));
  } catch (e) {
      console.error(e);
  }
}
test();
