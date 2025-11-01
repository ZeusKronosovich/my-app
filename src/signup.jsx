import React, { useState } from 'react';

const SignUpForm = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isFormVisible, setFormVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignUpClick = () => {
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

    if (login.length < 3) {
      setErrorMessage('Логин должен содержать минимум 3 символа');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Пароль должен содержать минимум 6 символов');
      return;
    }

    const response = await fetch('http://localhost:8081/account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ login, password }),
    });

    if (response.ok) {
      alert('Регистрация успешна!');
      setFormVisible(false);
      setLogin('');
      setPassword('');
    } else {
      const status = response.status;
      if (status === 500) {
        setErrorMessage('Логин занят, попробуйте другой.');
      } else {
        const errorText = await response.text();
        setErrorMessage('Ошибка: ' + errorText);
      }
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
    <div className="signup-form">
      {!isFormVisible ? (
        <button onClick={handleSignUpClick} className="auth-button">Регистрация</button>
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
            <button type="submit" className="auth-button">Зарегистрироваться</button>
            <button type="button" onClick={handleCancelClick} className="auth-button cancel">Отмена</button>
          </form>
          {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            Логин и пароль: только латинские буквы и цифры, максимум 20 символов
          </p>
        </div>
      )}
    </div>
  );
};

export default SignUpForm;