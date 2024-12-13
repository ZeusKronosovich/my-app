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
      onTokenReceived(data.token, data.login);
    } else {
      const errorText = await response.text();
      setErrorMessage('Ошибка: ' + errorText);
    }
  };

  const handleLoginChange = (e) => {
    const value = e.target.value;
    if (/^[a-zA-Z0-9]*$/.test(value)) {
      setLogin(value);
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    if (/^[a-zA-Z0-9]*$/.test(value)) {
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
            <button onClick={handleLoginClick} className="lfb">Вход</button>
          ) : (
            <div>
              <form onSubmit={handleSubmit}>
                <label htmlFor="login">Логин:</label>
                <input
                  type="text"
                  id="login"
                  value={login}
                  onChange={handleLoginChange}
                  required
                />
                <br />
                <label htmlFor="password">Пароль:</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                />
                <br />
                <button type="submit" className="lfb">Войти</button>
                <button type="button" className="lfb" onClick={handleCancelClick}>Отмена</button>
              </form>
              {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LoginForm;