import dayjs from 'dayjs';

function getDateRange(offsetDays, startTimeStr = '08:00', endTimeStr = '17:00') {
  let start, end;

  if (offsetDays === 0) {
    start = dayjs().startOf('day');
    end = dayjs().startOf('day');
  } else if (offsetDays === 1) {
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

// 测试
console.log('测试日期逻辑:');
console.log('今天:', getDateRange(0).map(d => dayjs(d).format('YYYY-MM-DD HH:mm:ss')));
console.log('明天:', getDateRange(1).map(d => dayjs(d).format('YYYY-MM-DD HH:mm:ss')));
console.log('未来3天:', getDateRange(3).map(d => dayjs(d).format('YYYY-MM-DD HH:mm:ss')));
