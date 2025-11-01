import React, { useState } from 'react';

const LoginForm = ({ onTokenReceived, currentLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isFormVisible, setFormVisible] = useState(false);

  const handleLoginClick = () => {
    setFormVisible(true);
  };

  const handleCancelClick = () => {
    setFormVisible(false);
    setErrorMessage('');
    setLogin('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const response = await fetch('http://localhost:8081/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ login, password }),
    });

    if (response.ok) {
      const data = await response.json();
      setFormVisible(false);
      onTokenReceived(data.token, data.login, data.role);
    } else {
      const errorText = await response.text();
      setErrorMessage('Ошибка: ' + errorText);
    }
  };

  const handleLoginChange = (e) => {
    const value = e.target.value;
    if (value.length <= 20 && /^[a-zA-Z0-9]*$/.test(value)) {
      setLogin(value);
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    if (value.length <= 20 && /^[a-zA-Z0-9]*$/.test(value)) {
      setPassword(value);
    }
  };

  return (
    <div>
      {currentLogin ? (
        <p>Вы авторизованы как: {currentLogin}</p>
      ) : (
        <>
          {!isFormVisible ? (
            <button 
              onClick={handleLoginClick} 
              className="auth-button"
              style={{ outline: 'none', boxShadow: 'none' }}
            >
              Вход
            </button>
          ) : (
            <div className="auth-form">
              <form onSubmit={handleSubmit}>
                <label htmlFor="login">
                  Логин:
                </label>
                <input
                  type="text"
                  id="login"
                  value={login}
                  onChange={handleLoginChange}
                  required
                  maxLength={20}
                  placeholder="Только латинские буквы и цифры"
                />
                <br />
                <label htmlFor="password">
                  Пароль:
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  maxLength={20}
                  placeholder="Только латинские буквы и цифры"
                />
                <br />
                <button 
                  type="submit" 
                  className="auth-button"
                  style={{ outline: 'none', boxShadow: 'none' }}
                >
                  Войти
                </button>
                <button 
                  type="button" 
                  className="auth-button cancel" 
                  onClick={handleCancelClick}
                  style={{ outline: 'none', boxShadow: 'none' }}
                >
                  Отмена
                </button>
              </form>
              {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
              <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                Логин и пароль: только латинские буквы и цифры, максимум 20 символов
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LoginForm;