import React from "react";
import { Input } from "antd";
import DatePicker from "./date-picker";
import Select from "./select";
import Slider from "./slider";
import InputNumber from "./number";

export default function modalFormItem(props) {
  const { config } = props;

  //组件合集
  const componentMap = {
    input: Input,
    number: InputNumber,
    date: DatePicker,
    select: Select,
    slider: Slider,
  };
  //根据父组件传来的config.type选取对应的组件比如componentMap[input]，这时会返回input组件给Component
  const Component = componentMap[config?.type];
  if (Component) return <Component {...props} />;
  else return null;
}
