import React, { useRef } from "react";
// import moment from "moment";
import dayjs from "dayjs";
// import Amount from '@/components/Widget/custom-amount';
import { DatePicker } from "antd";

export default function CustomDatePicker(props) {
  const {
    style,
    value,
    afterblur,
    onChange,
    config,
    curtask,
    gantt,
    // fieldMap,
    formref,
  } = props;

  const inputref = useRef();

  function handleChange(val) {
    onChange(val);
    afterblur(val);
  }

  //禁止选用部分日期
  function handleDisabledDate(cur) {
    const formValue = formref.current.getFieldsValue();
    let parentLimit = false;

    // 如果任务存在父级，将父级的任务日期作为可选择日期
    if (![null, 0, "0"].includes(formValue.parent)) {
      const parentTask = gantt.getTask(formValue.parent);
      const endDate = new Date(parentTask.end_date);
      endDate.setDate(endDate.getDate() - 1);
      // 限制只能在父任务的时间区间
      parentLimit =
        cur.isBefore(dayjs(parentTask.start_date)) ||
        cur.isAfter(dayjs(endDate));
    }

    // 过于久远的日期也不能选择
    const lowerLimit =
      cur.isBefore(dayjs("1970-01-01 00:00:00")) ||
      cur.isAfter(dayjs("2038-01-01 00:00:01"));

    if (parentLimit) return true;
    if (lowerLimit) return true;
    // 周末也不能选
    // TODO: 这里之后可以搞成节假日，因为有些周末调休后也得上班
    if ([0, 6].includes(cur.day())) return true;
  }

  return (
    <DatePicker
      inputref={inputref}
      style={style}
      value={dayjs.isDayjs(value) ? value : dayjs(value)}
      disabled={config.originField === "end_date"}
      disabledDate={handleDisabledDate}
      onChange={handleChange}
      allowClear={false}
    />
  );
}
