import {
  VSCodeButton,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import styled from '@emotion/styled';
import { useFormik } from 'formik';
import { settingMap } from './config';
import useSettingStore from '../../stores/useSettingStore.ts';
import useExtensionStore from '../../stores/useExtensionStore';
import * as Yup from 'yup';
import isFunction from 'lodash/isFunction';

const FormItemContainer = styled.div({
  boxSizing: 'border-box',
  display: 'flex',
  flexFlow: 'column nowrap',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  marginBottom: '10px',

  '& > label': {
    display: 'block',
    color: 'var(--vscode-foreground)',
    cursor: 'pointer',
    fontSize: 'var(--vscode-font-size)',
    lineHeight: 'normal',
    marginBottom: '2px',
  },

  '& > *': {
    maxWidth: '300px',
  },
});

const ErrorMessage = styled.div({
  color: 'var(--vscode-editorError-foreground)',
  marginTop: '2px',
});

const schema = Yup.object({
  provider: Yup.string().required('Provider is required'),
  model: Yup.string().required('Model is required'),
  apiKey: Yup.string().required('API Key is required'),
  baseUrl: Yup.string().when('provider', {
    is: (provider: string) => settingMap[provider]?.hasBaseUrl,
    then: (schema) => schema.required('Base URL is required'),
    otherwise: (schema) => schema.optional(),
  }),
});

export default function Setting() {
  const setting = useSettingStore((state) => state.model);
  const setSetting = useSettingStore((state) => state.setSetting);
  const setViewType = useExtensionStore((state) => state.setViewType);

  const formik = useFormik({
    initialValues: setting,
    validationSchema: schema,
    onSubmit: async (values) => {
      console.log(values);
      await setSetting(values);
      setViewType('chat');
    },
  });

  const providerSetting = settingMap[formik.values.provider];

  return (
    <div style={{ padding: '12px' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1
          style={{
            margin: '10px 0',
            fontSize: 'calc(var(--vscode-font-size) * 1.5)',
          }}
        >
          Settings
        </h1>
        <VSCodeButton
          disabled={formik.isSubmitting}
          onClick={() => formik.handleSubmit()}
        >
          {formik.isSubmitting ? 'Saving' : 'Save'}
        </VSCodeButton>
      </div>

      <FormItemContainer>
        <label>Provider</label>
        <VSCodeDropdown
          value={formik.values.provider}
          onChange={(e) => {
            const newProvider = (e.target as HTMLSelectElement).value;
            formik.setFieldTouched('provider');
            formik.setFieldValue('provider', newProvider);
            formik.setFieldValue('model', '');
            formik.setFieldValue('apiKey', '');
            formik.setFieldValue('baseUrl', '');
          }}
        >
          <VSCodeOption value="openai">OpenAI</VSCodeOption>
          <VSCodeOption value="anthropic">Anthropic</VSCodeOption>
          <VSCodeOption value="deepseek">DeepSeek</VSCodeOption>
          <VSCodeOption value="ollama">Ollama</VSCodeOption>
          <VSCodeOption value="openrouter">OpenRouter</VSCodeOption>
          <VSCodeOption value="openai_compatible">
            OpenAI Compatible
          </VSCodeOption>
        </VSCodeDropdown>
      </FormItemContainer>

      <FormItemContainer>
        <label>Model</label>
        {Array.isArray(providerSetting.model) ? (
          <VSCodeDropdown
            value={formik.values.model}
            onChange={(e) => {
              formik.setFieldTouched('model');
              formik.setFieldValue(
                'model',
                (e.target as HTMLSelectElement).value,
              );
            }}
          >
            {providerSetting.model.map((item) => (
              <VSCodeOption key={item.value} value={item.value}>
                {item.label}
              </VSCodeOption>
            ))}
          </VSCodeDropdown>
        ) : (
          <VSCodeTextField
            value={formik.values.model}
            onChange={(e) => {
              formik.setFieldTouched('model');
              formik.setFieldValue(
                'model',
                (e.target as HTMLInputElement).value,
              );
            }}
          />
        )}
        {formik.touched.model && formik.errors.model && (
          <ErrorMessage>{formik.errors.model}</ErrorMessage>
        )}
      </FormItemContainer>

      <FormItemContainer>
        <label>API Key</label>
        <VSCodeTextField
          type="password"
          value={formik.values.apiKey}
          onChange={(e) => {
            formik.setFieldTouched('apiKey');
            formik.setFieldValue(
              'apiKey',
              (e.target as HTMLInputElement).value,
            );
          }}
        />
        {formik.touched.apiKey && formik.errors.apiKey && (
          <ErrorMessage>{formik.errors.apiKey}</ErrorMessage>
        )}
      </FormItemContainer>

      {providerSetting.hasBaseUrl && (
        <FormItemContainer>
          <label>Base URL</label>
          <VSCodeTextField
            value={formik.values.baseUrl}
            onChange={(e) => {
              formik.setFieldTouched('baseUrl');
              formik.setFieldValue(
                'baseUrl',
                (e.target as HTMLInputElement).value,
              );
            }}
          />
          {formik.touched.baseUrl && formik.errors.baseUrl && (
            <ErrorMessage>{formik.errors.baseUrl}</ErrorMessage>
          )}
        </FormItemContainer>
      )}
    </div>
  );
}
