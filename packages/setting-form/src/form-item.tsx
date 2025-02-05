import React, { useState } from 'react';
import { toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import {
  clone,
  ComponentPropValidate,
  getCodeOfWrappedCode,
  IComponentProp,
  isNil,
  isString,
  isWrappedCode,
  wrapCode,
} from '@music163/tango-helpers';
import { ErrorBoundary } from '@music163/tango-ui';
import { code2value, value2code } from '@music163/tango-core';
import { InputProps } from 'antd';
import { useFormModel, useFormVariable } from './context';
import { FormControl, ToggleCodeButton } from './form-ui';
import { Box, Text } from 'coral-system';
import { ISetterOnChangeCallbackDetail } from './types';

export interface FormItemProps extends IComponentProp {
  /**
   * 无样式模式，仅返回 setter 组件
   */
  noStyle?: boolean;
  /**
   * 表单项右侧自定义区域
   */
  extra?: React.ReactNode;
  /**
   * 表单项底部自定义区域
   */
  footer?: React.ReactNode;
}

export interface FormItemComponentProps<T = any> {
  value?: T;
  onChange: (value: T, detail?: ISetterOnChangeCallbackDetail) => void;
  readOnly?: boolean;
  disabled?: boolean;
  status?: InputProps['status'];
  [prop: string]: any;
}

export interface IFormItemCreateOptions {
  /**
   * 设置器调用名
   */
  name: string;
  /**
   * 设置器别名列表，支持多个名字
   */
  alias?: string[];
  /**
   * 设置器类型，value类设置器支持切换到codeSetter，默认为 value setter
   */
  type?: 'code' | 'value';
  /**
   * 渲染设置器使用的组件
   */
  component?: React.ComponentType<FormItemComponentProps>;
  /**
   * 自定义渲染器 render 函数，render 优先级高于 component
   */
  render?: (args: FormItemComponentProps) => React.ReactElement;
  /**
   * 是否禁用变量设置器
   */
  disableVariableSetter?: boolean;
  /**
   * 默认的表单值校验逻辑
   */
  validate?: ComponentPropValidate;
}

const defaultGetSetterProps = () => ({});
const defaultGetVisible = () => true;

function parseFieldValue(fieldValue: any) {
  let value: any;
  let code: string;

  if (!fieldValue) {
    return [];
  }

  const isCodeString = isString(fieldValue) && isWrappedCode(fieldValue);
  if (isCodeString) {
    code = getCodeOfWrappedCode(fieldValue);
    try {
      // 避免 code 报错的情况
      value = code2value(code);
    } catch (err) {
      // do nothing
    }
  } else {
    code = value2code(fieldValue);
    value = fieldValue;
  }
  return [value, code];
}

interface UseSetterValueProps {
  fieldValue: any;
  setter?: string;
  setterType?: IFormItemCreateOptions['type'];
  /**
   * 强制初始化为 codeSetter，适用于外部需要特别干预的情况
   */
  forceCodeSetter?: boolean;
}

export function useSetterValue({
  fieldValue,
  setter,
  setterType,
  forceCodeSetter,
}: UseSetterValueProps) {
  const [value, code] = parseFieldValue(fieldValue);
  const [isCodeSetter, setIsCodeSetter] = useState(() => {
    if (forceCodeSetter) {
      return true;
    }

    // 同时不存在，表示是空置，使用默认模式
    if (!code && !value) {
      return false;
    }

    // value 解析出错的情况，使用 codeSetter
    if (isNil(value)) {
      return true;
    }

    // 其他情况，均使用默认模式
    return false;
  });

  const toggleSetter = () => {
    setIsCodeSetter(!isCodeSetter);
  };

  let fixedSetter: string;
  let setterValue: any;
  if (setterType === 'code') {
    fixedSetter = setter;
    setterValue = code;
  } else {
    fixedSetter = isCodeSetter ? 'codeSetter' : setter;
    setterValue = isCodeSetter ? code : value;
  }

  return {
    value,
    code,
    setter: fixedSetter,
    setterValue, // setter value
    isCodeSetter, // 是否为 codeSetter
    toggleSetter, // 切换 setter
  };
}

export function createFormItem(options: IFormItemCreateOptions) {
  const renderSetter =
    options.render ?? ((props: any) => React.createElement(options.component, props));
  const setterType = options.type ?? 'value'; // 设置器的模式

  function getShowToggleCodeButton(disableVariableSetter = options.disableVariableSetter) {
    if (setterType === 'code') {
      // codeSetter 无需切换按钮
      return false;
    }
    // 如果用户设置了 disableVariableSetter，则不显示切换按钮
    return !disableVariableSetter;
  }

  function FormItem({
    name,
    title,
    tip,
    placeholder,
    docs,
    autoCompleteOptions,
    setter: setterProp,
    setterProps,
    defaultValue,
    options: setterOptions,
    disableVariableSetter,
    getVisible: getVisibleProp,
    getSetterProps: getSetterPropsProp,
    deprecated,
    extra,
    footer,
    noStyle,
    validate = options.validate,
  }: FormItemProps) {
    const { disableSwitchExpressionSetter, showItemSubtitle } = useFormVariable();
    const model = useFormModel();
    const field = model.getField(name);

    const fieldValue = toJS(field.value ?? defaultValue);
    const { setterValue, setter, isCodeSetter, toggleSetter } = useSetterValue({
      fieldValue,
      setter: setterProp,
      setterType,
    });

    field.setConfig({
      validate: setter === 'codeSetter' ? getSetter('codeSetter').config.validate : validate,
    });

    let baseComponentProps: FormItemComponentProps = {
      value: setterValue,
      defaultValue,
      onChange(value, detail = {}) {
        if ((setterType === 'code' || isCodeSetter) && isString(value) && value) {
          detail.rawCode = value; // 在 detail 中记录原始的 code
          value = wrapCode(value);
        }
        field.setValue(value, detail);
      },
      status: field.error ? 'error' : undefined,
      placeholder,
      options: setterOptions,
    };
    baseComponentProps = clone(baseComponentProps, false);

    let expProps = {};

    // FIXME: 重新考虑这段代码的位置，外置这个逻辑
    if (
      ['codeSetter', 'expressionSetter', 'expSetter', 'actionSetter', 'eventSetter'].includes(
        setter,
      )
    ) {
      expProps = {
        modalTitle: title,
        modalTip: tip,
        autoCompleteOptions,
      };
    }

    const getSetterProps = getSetterPropsProp || defaultGetSetterProps;
    // 从注册表中获取 expSetter
    const CodeSetter = REGISTERED_FORM_ITEM_MAP['codeSetter']?.config?.component;

    const setterNode = isCodeSetter ? (
      <CodeSetter {...expProps} {...baseComponentProps} {...setterProps} />
    ) : (
      renderSetter({
        ...expProps,
        ...baseComponentProps,
        ...setterProps, // setterProps 优先级大于快捷属性
        ...getSetterProps(model),
      })
    );

    const getVisible = getVisibleProp || defaultGetVisible;

    if (noStyle) {
      // 无样式模式
      return getVisible(model) ? setterNode : <div data-setter={setter} data-field={name} />;
    }

    const showToggleCodeButton = getShowToggleCodeButton(
      disableSwitchExpressionSetter || disableVariableSetter,
    );

    return (
      <FormControl
        visible={getVisible(model)}
        label={title}
        note={showItemSubtitle ? name : null}
        tip={tip}
        docs={docs}
        deprecated={deprecated}
        error={field.error}
        extra={
          <Box>
            {extra}
            {showToggleCodeButton ? (
              <ToggleCodeButton selected={isCodeSetter} onToggle={toggleSetter} />
            ) : null}
          </Box>
        }
        footer={footer}
        data-setter={setter}
        data-field={name}
      >
        <ErrorBoundary>{setterNode}</ErrorBoundary>
      </FormControl>
    );
  }

  FormItem.displayName = `FormItem_${options.name}`;
  FormItem.config = options;

  return observer(FormItem);
}

// 已注册的 setter 查找表
const REGISTERED_FORM_ITEM_MAP: Record<string, ReturnType<typeof createFormItem>> = {};

/**
 * 获取已注册的 setter
 * @param name
 * @returns
 */
export function getSetter(name: string) {
  return REGISTERED_FORM_ITEM_MAP[name];
}

/**
 * Setter 注册
 * @param config 注册选项
 */
export function register(config: IFormItemCreateOptions) {
  // 允许直接覆盖同名 setter
  REGISTERED_FORM_ITEM_MAP[config.name] = createFormItem(config);
  (Array.isArray(config.alias) ? config.alias : []).forEach((alias) => {
    REGISTERED_FORM_ITEM_MAP[alias] = getSetter(config.name);
  });
}

export function SettingFormItem(props: FormItemProps) {
  const { setter } = props;
  const Comp = REGISTERED_FORM_ITEM_MAP[setter];
  if (Comp == null) {
    const Fallback = REGISTERED_FORM_ITEM_MAP.codeSetter;
    return (
      <Fallback
        {...props}
        footer={
          <Text color="#faad14" mt="m">
            invalid {props.setter}, fallback to codeSetter
          </Text>
        }
      />
    );
  }
  return React.createElement(Comp, props);
}
