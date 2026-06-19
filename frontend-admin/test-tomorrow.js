// 模拟测试明天的日期逻辑
const dayjs = require('dayjs');

function getDateRange(offsetDays, startTimeStr = '08:00', endTimeStr = '17:00') {
  let start, end;

  if (offsetDays === 0) {
    start = dayjs().startOf('day');
    end = dayjs().startOf('day');
  } else if (offsetDays === 1) {
    // 明天：起始和结束都是明天
    start = dayjs().add(1, 'day').startOf('day');
    end = dayjs().add(1, 'day').startOf('day');
  } else {
    start = dayjs().startOf('day');
    end = dayjs().add(offsetDays - 1, 'day').startOf('day');
  }

  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);

  const finalStartDate = start.hour(startH || 0).minute(startM || 0).second(0).toDate();
  const finalEndDate = end.hour(endH || 0).minute(endM || 0).second(59).toDate();

  return [finalStartDate, finalEndDate];
}

const today = dayjs();
const tomorrow = dayjs().add(1, 'day');

console.log('当前日期:', today.format('YYYY-MM-DD'));
console.log('明天日期:', tomorrow.format('YYYY-MM-DD'));
console.log('\n测试结果:');
const result = getDateRange(1, '08:00', '17:00');
console.log('起始日期:', dayjs(result[0]).format('YYYY-MM-DD HH:mm:ss'));
console.log('结束日期:', dayjs(result[1]).format('YYYY-MM-DD HH:mm:ss'));
console.log('\n验证:');
console.log('起始日期是明天?', dayjs(result[0]).isSame(tomorrow, 'day'));
console.log('结束日期是明天?', dayjs(result[1]).isSame(tomorrow, 'day'));
